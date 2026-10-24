import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unwrap } from "@/services/server/action";
import { serviceAction } from "@/services/world/serviceActions";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { updateOrganizationSubscriptionAction } from "../subscriptionActions";
import { simulateAsaasSubscriptionPaymentAction } from "../subscriptionCheckoutActions";

/**
 * Plano pago so pelo pagamento conferido no servidor (achado 66 do teste de
 * 23/10): nem a troca direta nem o espaco gravam o Profissional numa conta real.
 */

let tenant: TestTenant;
const admin = adminClient();

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function tierInDb(): Promise<string | undefined> {
  const { data } = await admin.from("organizations").select("subscription").eq("id", tenant.organizationId).single();
  return (data?.subscription as { tier?: string } | null)?.tier;
}

describe("plano GestaraHub na conta real", () => {
  it("a troca direta recusa o Profissional", async () => {
    await expect(unwrap(updateOrganizationSubscriptionAction(tenant.organizationId, "pro"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await tierInDb()).not.toBe("pro");
  });

  it("voltar ao Grátis continua valendo", async () => {
    await admin
      .from("organizations")
      .update({ subscription: { tier: "pro", status: "active" } })
      .eq("id", tenant.organizationId);

    const saved = await unwrap(updateOrganizationSubscriptionAction(tenant.organizationId, "free"));

    expect(saved.tier).toBe("free");
    expect(await tierInDb()).toBe("free");
  });

  it("o espaço não grava o plano vindo junto dos dados da organização", async () => {
    await unwrap(serviceAction("settings.updateOrganization", [{ name: "Escola Nova", subscription: { tier: "pro" } }]));

    const { data } = await admin.from("organizations").select("name").eq("id", tenant.organizationId).single();
    expect(data?.name).toBe("Escola Nova");
    expect(await tierInDb()).not.toBe("pro");
  });

  it("simular o pagamento do plano fora do Asaas de testes é recusado", async () => {
    const previous = process.env.ASAAS_API_URL;
    process.env.ASAAS_API_URL = "https://api.asaas.com/v3";
    try {
      const result = await simulateAsaasSubscriptionPaymentAction("pay_mock_1", "pro", "monthly");
      expect(result.success).toBe(false);
    } finally {
      process.env.ASAAS_API_URL = previous;
    }
    expect(await tierInDb()).not.toBe("pro");
  });
});
