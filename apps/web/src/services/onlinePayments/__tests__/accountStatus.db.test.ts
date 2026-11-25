import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Analise da conta de recebimento no Asaas (25/11/2026): a situacao lida no
 * Asaas fica no espaco, os documentos que faltam vao para o cartao "Deixe sua
 * conta pronta", e a aprovacao (aviso ACCOUNT_STATUS_*) cria a chave Pix e
 * avisa o dono uma vez so.
 */

const asaas = vi.hoisted(() => ({
  getAccountStatus: vi.fn(),
  getAccountDocuments: vi.fn(),
  listPixAddressKeys: vi.fn(),
  createPixAddressKey: vi.fn(),
}));
const email = vi.hoisted(() => ({ sendPlanNoticeEmail: vi.fn() }));
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
}));
vi.mock("@/lib/email/ses", () => email);

const { loadSubaccountOnboarding, recordAccountStatusFromWebhook } = await import("../accountStatus");

const admin = adminClient();
let tenant: TestTenant;

async function asaasStatus() {
  const { data } = await admin.from("organizations").select("settings").eq("id", tenant.organizationId).single();
  return (data?.settings as { onlinePayments?: { asaasStatus?: { general: string; documentation?: string } } })?.onlinePayments?.asaasStatus;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ASAAS_API_KEY", "chave-principal");
  email.sendPlanNoticeEmail.mockResolvedValue({ ok: true });
  asaas.listPixAddressKeys.mockResolvedValue([]);
  asaas.createPixAddressKey.mockResolvedValue({ id: "pix_1", key: "chave", status: "ACTIVE" });
  tenant = await createTestTenant();
  await admin
    .from("organizations")
    .update({ gateway_api_key: "chave-da-subconta", gateway_account_id: "acc_teste", gateway_status: "approved" })
    .eq("id", tenant.organizationId)
    .throwOnError();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await tenant.remove();
});

describe("análise da conta no Asaas", () => {
  it("lê a situação e os documentos que faltam, grava no espaço e deixa de fora o dispensado", async () => {
    asaas.getAccountStatus.mockResolvedValue({ general: "PENDING", documentation: "PENDING", commercialInfo: "APPROVED", bankAccountInfo: "APPROVED" });
    asaas.getAccountDocuments.mockResolvedValue({
      rejectReasons: null,
      data: [
        { id: "doc_1", status: "NOT_SENT", type: "IDENTIFICATION", title: "Documento de identidade", description: "Não possui descrição", onboardingUrl: "https://asaas.test/envio" },
        { id: "doc_2", status: "IGNORED", type: "CUSTOM", title: "Outro" },
      ],
    });

    const view = await loadSubaccountOnboarding(tenant.organizationId);
    expect(asaas.getAccountStatus).toHaveBeenCalledWith("chave-da-subconta");
    expect(view?.status).toMatchObject({ general: "PENDING", documentation: "PENDING" });
    expect(view?.documents).toEqual([
      { id: "doc_1", type: "IDENTIFICATION", title: "Documento de identidade", status: "NOT_SENT", onboardingUrl: "https://asaas.test/envio" },
    ]);
    expect(await asaasStatus()).toMatchObject({ general: "PENDING" });
    // Ainda pendente: nada de aviso de aprovação.
    expect(email.sendPlanNoticeEmail).not.toHaveBeenCalled();
  });

  it("sem subconta de verdade (demonstração): nada a ler", async () => {
    await admin.from("organizations").update({ gateway_api_key: "mock_key_1" }).eq("id", tenant.organizationId);
    expect(await loadSubaccountOnboarding(tenant.organizationId)).toBeNull();
    expect(asaas.getAccountStatus).not.toHaveBeenCalled();
  });

  it("aviso de aprovação: grava, cria a chave Pix e avisa o dono uma vez só", async () => {
    const owner = await tenant.addUser("owner");
    expect(await recordAccountStatusFromWebhook(admin, "acc_teste", { general: "APPROVED", documentation: "APPROVED" })).toBe(
      tenant.organizationId,
    );
    expect(await asaasStatus()).toMatchObject({ general: "APPROVED", documentation: "APPROVED" });
    expect(asaas.createPixAddressKey).toHaveBeenCalled();
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: owner.email, title: "Conta de recebimento aprovada" }),
    );

    // Aviso repetido (o Asaas manda pelo menos uma vez): sem segundo e-mail.
    email.sendPlanNoticeEmail.mockClear();
    await recordAccountStatusFromWebhook(admin, "acc_teste", { general: "APPROVED" });
    expect(email.sendPlanNoticeEmail).not.toHaveBeenCalled();
  });

  it("aviso de conta que não é de nenhum espaço: ignora", async () => {
    expect(await recordAccountStatusFromWebhook(admin, "acc_outra", { general: "APPROVED" })).toBeNull();
  });
});
