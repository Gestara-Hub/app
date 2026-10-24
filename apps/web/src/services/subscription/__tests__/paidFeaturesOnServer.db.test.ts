import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unwrap, type ActionResult } from "@/services/server/action";
import { forgetCachedWorld } from "@/services/world/runWorld";
import { serviceAction } from "@/services/world/serviceActions";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Achado 80 do teste geral: o recurso pago e conferido no servidor. Quem chama
 * a action direto, numa conta Gratis, e recusado; o plano vem do banco (gravado
 * so pelo servidor, achados 66 e 77), nao do que o navegador manda.
 */

let tenant: TestTenant;
const admin = adminClient();
const call = <T>(method: string, ...args: unknown[]) =>
  unwrap(serviceAction(method, args) as Promise<ActionResult<T>>);

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  forgetCachedWorld(tenant.organizationId);
  await tenant.remove();
});

async function setTier(tier: "free" | "pro"): Promise<void> {
  await admin
    .from("organizations")
    .update({ subscription: tier === "free" ? { tier } : { tier, status: "active" } })
    .eq("id", tenant.organizationId);
  forgetCachedWorld(tenant.organizationId);
}

const PAID_CALLS: [string, string, unknown[]][] = [
  ["relatório avançado (DRE)", "reports.generateReport", ["financial_income_statement", { competence: "2026-10" }]],
  ["relatório avançado (retenção)", "reports.generateReport", ["churn_retention", { competence: "2026-10" }]],
  ["modelo do certificado", "certificates.resetTemplate", []],
  ["WhatsApp oficial", "communication.connectOfficial", []],
];

describe("recursos pagos conferidos no servidor", () => {
  it.each(PAID_CALLS)("Grátis: %s é recusado", async (_label, method, args) => {
    await setTier("free");
    await expect(call(method, ...args)).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
  });

  it("o plano mandado junto com o pedido não libera o recurso", async () => {
    await setTier("free");
    await call("settings.updateOrganization", { name: "Escola", subscription: { tier: "pro", status: "active" } });
    await expect(call("reports.generateReport", "financial_income_statement", { competence: "2026-10" })).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
    });
  });

  it("Profissional: o relatório avançado sai", async () => {
    await setTier("pro");
    await expect(call("reports.generateReport", "financial_income_statement", { competence: "2026-10" })).resolves.toBeTruthy();
  });
});
