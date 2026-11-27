import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasApiError } from "@/lib/asaas";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Chave de API da subconta (27/11/2026, doc product/19): o uso semanal mantem a
 * chave viva, o aviso de expiracao usa na hora, e expirada/desligada/apagada
 * trava o "Cobrar online" (recusa ao gerar o Pix) ate a troca.
 */

const asaas = vi.hoisted(() => ({ getAccountStatus: vi.fn() }));
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
}));
// Chave invalida avisa o dono por e-mail (sem sair de verdade no teste).
const email = vi.hoisted(() => ({ sendPlanNoticeEmail: vi.fn() }));
vi.mock("@/lib/email/ses", () => email);

const { keepSpaceApiKeyAlive, recordApiKeyEvent, KEEP_ALIVE_EVERY_MS, isApiKeyInvalid } = await import("../apiKeyHealth");

const admin = adminClient();
let tenant: TestTenant;

async function keyStatus() {
  const { data } = await admin.from("organizations").select("settings").eq("id", tenant.organizationId).single();
  return (data?.settings as { onlinePayments?: { apiKeyStatus?: Record<string, unknown> } })?.onlinePayments?.apiKeyStatus;
}

async function settings() {
  const { data } = await admin.from("organizations").select("settings").eq("id", tenant.organizationId).single();
  return data?.settings;
}

beforeEach(async () => {
  vi.clearAllMocks();
  asaas.getAccountStatus.mockResolvedValue({ general: "APPROVED" });
  email.sendPlanNoticeEmail.mockResolvedValue({ ok: true });
  tenant = await createTestTenant();
  await admin
    .from("organizations")
    .update({ gateway_api_key: "chave-da-subconta", gateway_account_id: "acc_chave", gateway_status: "approved" })
    .eq("id", tenant.organizationId)
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

describe("chave da subconta: manter viva", () => {
  it("usa a chave uma vez por semana", async () => {
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId)).toBe("alive");
    expect(asaas.getAccountStatus).toHaveBeenCalledWith("chave-da-subconta");
    expect(await keyStatus()).toMatchObject({ state: "valid" });

    // No dia seguinte: ainda nao faz uma semana.
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId, Date.now() + 24 * 3600 * 1000)).toBe("skipped");
    // Uma semana depois: usa de novo.
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId, Date.now() + KEEP_ALIVE_EVERY_MS + 1000)).toBe("alive");
    expect(asaas.getAccountStatus).toHaveBeenCalledTimes(2);
  });

  it("recusada pelo parceiro: chave inválida e o Cobrar online trava", async () => {
    asaas.getAccountStatus.mockRejectedValue(new AsaasApiError("Unauthorized", 401));
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId)).toBe("invalid");
    expect(await keyStatus()).toMatchObject({ state: "invalid", reason: "unauthorized" });
    expect(isApiKeyInvalid(await settings())).toBe(true);
    expect(email.sendPlanNoticeEmail).toHaveBeenCalled();
    // Invalida: a rotina espera a troca, nao tenta de novo.
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId, Date.now() + KEEP_ALIVE_EVERY_MS * 2)).toBe("skipped");
  });

  it("falha passageira (rede, parceiro fora) não muda nada", async () => {
    asaas.getAccountStatus.mockRejectedValue(new Error("fetch failed"));
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId)).toBe("failed");
    expect(await keyStatus()).toBeUndefined();
  });

  it("sem subconta de verdade (demonstração): nada", async () => {
    await admin.from("organizations").update({ gateway_api_key: "mock_key_1" }).eq("id", tenant.organizationId);
    expect(await keepSpaceApiKeyAlive(admin, tenant.organizationId)).toBe("skipped");
    expect(asaas.getAccountStatus).not.toHaveBeenCalled();
  });
});

describe("avisos ACCESS_TOKEN_* da subconta", () => {
  it("vai expirar: usa a chave na hora e segue valendo", async () => {
    const result = await recordApiKeyEvent(admin, "acc_chave", "ACCESS_TOKEN_EXPIRING_SOON", { id: "tok_1" });
    expect(result?.organizationId).toBe(tenant.organizationId);
    expect(asaas.getAccountStatus).toHaveBeenCalledWith("chave-da-subconta");
    expect(await keyStatus()).toMatchObject({ state: "valid" });
    expect((await keyStatus())?.expiringNoticeAt).toBeTruthy();
  });

  it("expirou e a chave em uso é recusada: trava com o motivo do aviso; religada e conferida: libera", async () => {
    asaas.getAccountStatus.mockRejectedValue(new AsaasApiError("Unauthorized", 401));
    await recordApiKeyEvent(admin, "acc_chave", "ACCESS_TOKEN_EXPIRED", { id: "tok_1" });
    expect(await keyStatus()).toMatchObject({ state: "invalid", reason: "expired" });

    asaas.getAccountStatus.mockResolvedValue({ general: "APPROVED" });
    await recordApiKeyEvent(admin, "acc_chave", "ACCESS_TOKEN_ENABLED", { id: "tok_1", enabled: true });
    expect(await keyStatus()).toMatchObject({ state: "valid" });
    expect((await keyStatus())?.reason).toBeUndefined();
  });

  it("aviso de outra chave ou atrasado (a chave em uso vale): não trava", async () => {
    const result = await recordApiKeyEvent(admin, "acc_chave", "ACCESS_TOKEN_DISABLED", { id: "tok_antiga", disableReason: "MANUAL" });
    expect(result?.outcome).toContain("outra chave");
    expect(await keyStatus()).toMatchObject({ state: "valid" });
  });

  it("conta que não é de espaço (a conta principal): ignorado", async () => {
    expect(await recordApiKeyEvent(admin, "acc_principal", "ACCESS_TOKEN_EXPIRED", { id: "tok_9" })).toBeNull();
  });
});
