import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";

/**
 * Liquidacao simulada no Asaas de testes (achado 76 do teste geral): a baixa vai
 * ao parceiro antes, com a data de hoje no fuso do espaco; se o parceiro recusa,
 * a cobranca continua em aberto no app (antes: marcava pago e ignorava a recusa).
 */

const receiveInCash = vi.fn();
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  receiveInCash: (...args: unknown[]) => receiveInCash(...args),
}));
vi.mock("@/lib/payments-test-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments-test-mode")>()),
  serverPaymentsTestMode: () => true,
}));

const { simulateOnlinePaidAction } = await import("../paymentRecordsActions");

let tenant: TestTenant;
let chargeId: string;
let paymentId: string;

beforeEach(async () => {
  receiveInCash.mockReset();
  tenant = await createTestTenant();
  const org = tenant.organizationId;
  const studentId = randomUUID();
  chargeId = randomUUID();
  paymentId = randomUUID();
  await adminClient().from("clients").insert({ id: studentId, organization_id: org, name: "Ana", phone: "11977770000", status: "active" }).throwOnError();
  await adminClient()
    .from("charges")
    .insert({ id: chargeId, organization_id: org, student_id: studentId, kind: "extra", description: "Kimono", due_date: "2026-10-30", amount_cents: 15000, status: "pending" })
    .throwOnError();
  await adminClient()
    .from("online_payments")
    .insert({
      id: paymentId,
      organization_id: org,
      charge_id: chargeId,
      client_id: studentId,
      method: "link",
      status: "awaiting",
      amount_cents: 15000,
      net_amount_cents: 15000,
      gateway_provider: "asaas",
      gateway_payment_id: "pay_teste_76",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .throwOnError();
  await signInAs(tenant.owner);
});

afterEach(async () => {
  await tenant.remove();
});

async function statusOf() {
  const { data: charge } = await adminClient().from("charges").select("status").eq("id", chargeId).single();
  const { data: payment } = await adminClient().from("online_payments").select("status").eq("id", paymentId).single();
  return { charge: charge?.status, payment: payment?.status };
}

describe("liquidação simulada no Asaas de testes", () => {
  it("parceiro recusou: a cobrança continua em aberto", async () => {
    receiveInCash.mockRejectedValue(new Error("A data selecionada não pode ser posterior a data atual."));
    const result = await simulateOnlinePaidAction(paymentId);
    expect(result).toEqual({ ok: false, reason: "gateway_refused" });
    expect(await statusOf()).toEqual({ charge: "pending", payment: "awaiting" });
  });

  it("parceiro aceitou: pago, com a data de hoje no fuso do Brasil", async () => {
    receiveInCash.mockResolvedValue(undefined);
    const result = await simulateOnlinePaidAction(paymentId);
    expect(result.ok).toBe(true);
    expect(await statusOf()).toEqual({ charge: "paid", payment: "paid" });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    expect(receiveInCash).toHaveBeenCalledWith("pay_teste_76", today, 150, undefined);
  });
});
