import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Fatura publica da cobranca (/p/c/<id>, doc technical/25 §7), aberta sem login:
 * o CPF digitado vale so para a cobranca (nao muda o cadastro), aluno menor
 * precisa do responsavel, so as formas aceitas e o codigo antigo sai tambem no
 * Asaas (sem pagamento em dobro).
 */

const gateway = vi.hoisted(() => ({ createPix: vi.fn(), createLink: vi.fn() }));
const cleanup = vi.hoisted(() => ({ cancelGatewayPayment: vi.fn() }));
vi.mock("@/services/payments/registry", () => ({ getPaymentGateway: () => gateway }));
vi.mock("@/services/onlinePayments/gatewayCleanup", () => cleanup);

const { createPublicChargePaymentAction } = await import("../chargeInvoiceActions");

const admin = adminClient();
let tenant: TestTenant;
let chargeId: string;
let studentId: string;
const SUBACCOUNT_KEY = "chave_subconta_teste";

async function setup(student: Record<string, unknown>, accepted = { pix: true, card: false, boleto: false }) {
  const org = tenant.organizationId;
  studentId = randomUUID();
  chargeId = randomUUID();
  await admin
    .from("organizations")
    .update({ gateway_api_key: SUBACCOUNT_KEY, settings: { onlinePayments: { enabled: true, acceptedMethods: accepted } } })
    .eq("id", org)
    .throwOnError();
  await admin.from("clients").insert({ id: studentId, organization_id: org, status: "active", phone: "11977770000", ...student }).throwOnError();
  await admin
    .from("charges")
    .insert({ id: chargeId, organization_id: org, student_id: studentId, kind: "extra", description: "Kimono", due_date: "2026-11-10", amount_cents: 15000, status: "pending" })
    .throwOnError();
}

beforeEach(async () => {
  vi.clearAllMocks();
  tenant = await createTestTenant();
  gateway.createPix.mockResolvedValue({
    provider: "asaas",
    providerId: `pay_${randomUUID()}`,
    pixCopyPaste: "000201pix",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  cleanup.cancelGatewayPayment.mockResolvedValue("canceled");
});

afterEach(async () => {
  await tenant.remove();
});

describe("fatura pública da cobrança", () => {
  it("o CPF digitado vale só para a cobrança: o cadastro do aluno não muda", async () => {
    await setup({ name: "Ana Souza", birth_date: "1990-01-01" });

    const result = await createPublicChargePaymentAction({ chargeId, method: "pix", cpf: "529.982.247-25" });

    expect(result.ok).toBe(true);
    expect(gateway.createPix).toHaveBeenCalledWith(expect.objectContaining({ studentCpf: "52998224725", subaccountApiKey: SUBACCOUNT_KEY }));
    const { data } = await admin.from("clients").select("cpf").eq("id", studentId).single();
    expect(data?.cpf).toBeNull();
  });

  it("aluno menor sem responsável financeiro: pede ao espaço, não usa o CPF digitado", async () => {
    await setup({ name: "Gabi", birth_date: "2015-05-05" });

    const result = await createPublicChargePaymentAction({ chargeId, method: "pix", cpf: "529.982.247-25" });

    expect(result).toEqual({ ok: false, error: "Aluno menor de idade: peça ao espaço para cadastrar o responsável financeiro." });
    expect(gateway.createPix).not.toHaveBeenCalled();
  });

  it("forma desligada em Recebimentos online é recusada", async () => {
    await setup({ name: "Ana Souza", cpf: "52998224725", birth_date: "1990-01-01" });

    const result = await createPublicChargePaymentAction({ chargeId, method: "link" });

    expect(result.ok).toBe(false);
    expect(gateway.createLink).not.toHaveBeenCalled();
  });

  it("código antigo em aberto sai também no Asaas", async () => {
    await setup({ name: "Ana Souza", cpf: "52998224725", birth_date: "1990-01-01" }, { pix: true, card: true, boleto: false });
    const oldId = randomUUID();
    await admin
      .from("online_payments")
      .insert({
        id: oldId,
        organization_id: tenant.organizationId,
        charge_id: chargeId,
        client_id: studentId,
        method: "link",
        status: "awaiting",
        amount_cents: 15000,
        net_amount_cents: 15000,
        gateway_provider: "asaas",
        gateway_payment_id: "pay_antigo",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .throwOnError();

    const result = await createPublicChargePaymentAction({ chargeId, method: "pix" });

    expect(result.ok).toBe(true);
    expect(cleanup.cancelGatewayPayment).toHaveBeenCalledWith("pay_antigo", SUBACCOUNT_KEY);
    const { data: old } = await admin.from("online_payments").select("status").eq("id", oldId).single();
    expect(old?.status).toBe("canceled");
    const { data: open } = await admin.from("online_payments").select("id").eq("charge_id", chargeId).eq("status", "awaiting");
    expect(open).toHaveLength(1);
  });
});
