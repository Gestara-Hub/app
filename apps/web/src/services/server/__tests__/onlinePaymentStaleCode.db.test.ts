import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { markOnlinePaymentPaidInDb } from "../../onlinePayments/onlinePaymentsWebhook";

/**
 * Codigo antigo pago depois de a cobranca sair do aberto (30/10/2026): a baixa
 * so vale para cobranca em aberto. Cancelada (troca de plano, inativacao) nao
 * volta a valer ao lado da substituta, e a paga em dinheiro nao vira Pix; o
 * resultado traz o conflito para o aviso ao dono.
 */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function chargeWithCode(charge: Record<string, unknown>): Promise<{ chargeId: string; gatewayId: string }> {
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
      kind: "membership",
      due_date: "2026-10-10",
      amount_cents: 15000,
      ...charge,
    })
    .throwOnError();
  const gatewayId = `pay_${randomUUID().slice(0, 12)}`;
  await admin
    .from("online_payments")
    .insert({
      organization_id: tenant.organizationId,
      charge_id: chargeId,
      method: "pix",
      amount_cents: 15000,
      status: "awaiting",
      gateway_provider: "asaas",
      gateway_payment_id: gatewayId,
      pix_copy_paste: "000201pix",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .throwOnError();
  return { chargeId, gatewayId };
}

async function chargeRow(id: string) {
  const { data } = await adminClient().from("charges").select("status, method, paid_via").eq("id", id).single();
  return data;
}

const PAID_AT = "2026-10-22T15:00:00.000Z";

describe("pagamento online de cobrança fora do aberto", () => {
  it("em aberto: dá baixa, sem conflito", async () => {
    const { chargeId, gatewayId } = await chargeWithCode({ status: "pending" });
    const result = await markOnlinePaymentPaidInDb(gatewayId, PAID_AT, "asaas");
    expect(result?.conflict).toBeUndefined();
    expect(await chargeRow(chargeId)).toMatchObject({ status: "paid", method: "pix", paid_via: "online" });
  });

  it("cancelada pelo sistema: continua cancelada e o conflito volta", async () => {
    const { chargeId, gatewayId } = await chargeWithCode({ status: "canceled", canceled_by: "system" });
    const result = await markOnlinePaymentPaidInDb(gatewayId, PAID_AT, "asaas");
    expect(result?.conflict).toBe("closed");
    expect(result?.payment.status).toBe("paid");
    expect((await chargeRow(chargeId))?.status).toBe("canceled");
  });

  it("paga em dinheiro: continua em dinheiro (não vira Pix) e o conflito volta", async () => {
    const { chargeId, gatewayId } = await chargeWithCode({ status: "paid", method: "cash", paid_at: "2026-10-20T12:00:00.000Z" });
    const result = await markOnlinePaymentPaidInDb(gatewayId, PAID_AT, "asaas");
    expect(result?.conflict).toBe("already_paid");
    expect(await chargeRow(chargeId)).toMatchObject({ status: "paid", method: "cash" });
  });

  it("aviso repetido do mesmo pagamento (confirmado e depois recebido) não é conflito", async () => {
    const { gatewayId } = await chargeWithCode({ status: "pending" });
    await markOnlinePaymentPaidInDb(gatewayId, PAID_AT, "asaas");
    const again = await markOnlinePaymentPaidInDb(gatewayId, PAID_AT, "asaas");
    expect(again?.newlyPaid).toBe(false);
    expect(again?.conflict).toBeUndefined();
  });
});
