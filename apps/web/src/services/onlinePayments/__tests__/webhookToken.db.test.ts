import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Token do webhook das subcontas (19/11/2026): trocar a ASAAS_WEBHOOK_SECRET
 * recadastra o webhook de cada subconta na proxima leitura, com o token novo.
 * O banco guarda so uma impressao do token, nunca o token.
 */

const asaas = vi.hoisted(() => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  getAccountFees: vi.fn(),
}));
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
}));

const { refreshGatewayIfNeeded, webhookFingerprint } = await import("../gatewaySetup");

const admin = adminClient();
let tenant: TestTenant;
const URL = "https://app.test/api/webhooks/asaas";

async function row() {
  const { data } = await admin
    .from("organizations")
    .select("id, gateway_api_key, gateway_fees, gateway_webhook_url")
    .eq("id", tenant.organizationId)
    .single();
  return data!;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ASAAS_API_KEY", "chave-principal");
  vi.stubEnv("ASAAS_WEBHOOK_URL", URL);
  vi.stubEnv("ASAAS_WEBHOOK_EMAIL", "avisos@gestarahub.test");
  vi.stubEnv("ASAAS_WEBHOOK_SECRET", "token-antigo");
  asaas.listWebhooks.mockResolvedValue([{ id: "wh_1", name: "GestaraHub" }]);
  asaas.updateWebhook.mockResolvedValue({ id: "wh_1" });
  asaas.getAccountFees.mockRejectedValue(new Error("sem tarifas no teste"));
  tenant = await createTestTenant();
  await admin
    .from("organizations")
    .update({ gateway_api_key: "chave-da-subconta", gateway_webhook_url: webhookFingerprint(URL, "token-antigo") })
    .eq("id", tenant.organizationId)
    .throwOnError();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await tenant.remove();
});

describe("token do webhook das subcontas", () => {
  it("mesmo token e URL: não recadastra", async () => {
    await refreshGatewayIfNeeded(await row());
    expect(asaas.updateWebhook).not.toHaveBeenCalled();
  });

  it("token novo: recadastra com o token novo, religa a fila e guarda só a impressão", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_SECRET", "token-novo");
    await refreshGatewayIfNeeded(await row());

    expect(asaas.updateWebhook).toHaveBeenCalledWith(
      "wh_1",
      expect.objectContaining({ authToken: "token-novo", url: URL, interrupted: false, enabled: true }),
      "chave-da-subconta",
    );
    const saved = String((await row()).gateway_webhook_url);
    expect(saved).toBe(webhookFingerprint(URL, "token-novo"));
    expect(saved).not.toContain("token-novo");
  });

  it("cadastro antigo, só com a URL: recadastra uma vez", async () => {
    await admin.from("organizations").update({ gateway_webhook_url: URL }).eq("id", tenant.organizationId).throwOnError();
    await refreshGatewayIfNeeded(await row());
    expect(asaas.updateWebhook).toHaveBeenCalledTimes(1);

    await refreshGatewayIfNeeded(await row());
    expect(asaas.updateWebhook).toHaveBeenCalledTimes(1);
  });
});
