import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { expireAllDueOnlinePayments } from "../gatewayAccountBackend";

/**
 * Cron de hora em hora (migracao 34): uma consulta para todos os espacos expira
 * os Pix e links vencidos; os em validade e os ja pagos ficam como estao.
 * Pagamentos do gateway simulado (sem chamada ao Asaas).
 */

let tenants: TestTenant[] = [];

beforeEach(async () => {
  tenants = [await createTestTenant(), await createTestTenant()];
});

afterEach(async () => {
  for (const t of tenants) await t.remove();
});

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

/** Cobranca do espaco com um pagamento online no estado e validade informados. */
async function onlinePayment(tenant: TestTenant, status: "awaiting" | "paid", expiresAt: string): Promise<string> {
  const admin = adminClient();
  const clientId = randomUUID();
  await admin
    .from("clients")
    .insert({ id: clientId, organization_id: tenant.organizationId, name: "Aluno", phone: "11977770000" })
    .throwOnError();
  const chargeId = randomUUID();
  await admin
    .from("charges")
    .insert({
      id: chargeId,
      organization_id: tenant.organizationId,
      student_id: clientId,
      kind: "extra",
      due_date: expiresAt.slice(0, 10),
      amount_cents: 5000,
      status: "pending",
    })
    .throwOnError();
  const { data } = await admin
    .from("online_payments")
    .insert({
      organization_id: tenant.organizationId,
      charge_id: chargeId,
      method: "pix",
      amount_cents: 5000,
      status,
      gateway_provider: "mock",
      expires_at: expiresAt,
    })
    .select("id")
    .single()
    .throwOnError();
  return String(data!.id);
}

describe("expiração dos pagamentos online (cron por hora)", () => {
  it("expira os vencidos de todos os espaços, sem mexer nos válidos e nos pagos", async () => {
    const [a, b] = tenants;
    const dueA = await onlinePayment(a, "awaiting", hoursFromNow(-2));
    const dueB = await onlinePayment(b, "awaiting", hoursFromNow(-1));
    const valid = await onlinePayment(a, "awaiting", hoursFromNow(5));
    const paid = await onlinePayment(b, "paid", hoursFromNow(-3));

    expect(await expireAllDueOnlinePayments()).toBeGreaterThanOrEqual(2);

    const { data } = await adminClient().from("online_payments").select("id, status").in("id", [dueA, dueB, valid, paid]);
    const statusOf = Object.fromEntries((data ?? []).map((r) => [r.id, r.status]));
    expect(statusOf).toEqual({ [dueA]: "expired", [dueB]: "expired", [valid]: "awaiting", [paid]: "paid" });

    // Rodar de novo não acha mais nada desses espaços.
    await expireAllDueOnlinePayments();
    const { data: again } = await adminClient().from("online_payments").select("status").eq("id", valid).single();
    expect(again?.status).toBe("awaiting");
  });
});
