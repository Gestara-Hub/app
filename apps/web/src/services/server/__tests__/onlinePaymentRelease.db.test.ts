import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { markOnlinePaymentPaidInDb } from "../../onlinePaymentsWebhook";

/**
 * Pago x disponivel (migracao 38): PAYMENT_CONFIRMED deixa o valor "a liberar"
 * com a data prevista; PAYMENT_RECEIVED libera. Aviso fora de ordem nao volta.
 */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function cardPayment(): Promise<string> {
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
      status: "pending",
    })
    .throwOnError();
  const gatewayId = `pay_${randomUUID().slice(0, 12)}`;
  await admin
    .from("online_payments")
    .insert({
      organization_id: tenant.organizationId,
      charge_id: chargeId,
      method: "link",
      amount_cents: 15000,
      status: "awaiting",
      gateway_provider: "asaas",
      gateway_payment_id: gatewayId,
      link_url: "https://parceiro.example/fatura/1",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .throwOnError();
  return gatewayId;
}

async function row(gatewayId: string) {
  const { data } = await adminClient()
    .from("online_payments")
    .select("status, funds_released, credit_date")
    .eq("gateway_payment_id", gatewayId)
    .single();
  return data;
}

const PAID_AT = "2026-10-22T15:00:00.000Z";

describe("pagamento online: pago x liberado", () => {
  it("cartão confirmado fica a liberar com a data prevista; recebido libera", async () => {
    const id = await cardPayment();
    await markOnlinePaymentPaidInDb(id, PAID_AT, "asaas", {
      paidMethod: "creditCard",
      release: { released: false, creditDate: "2026-11-24" },
    });
    expect(await row(id)).toEqual({ status: "paid", funds_released: false, credit_date: "2026-11-24" });

    await markOnlinePaymentPaidInDb(id, PAID_AT, "asaas", {
      paidMethod: "creditCard",
      release: { released: true, creditDate: "2026-11-23" },
    });
    expect(await row(id)).toEqual({ status: "paid", funds_released: true, credit_date: "2026-11-23" });
  });

  it("confirmado que chega depois do recebido não volta para a liberar", async () => {
    const id = await cardPayment();
    await markOnlinePaymentPaidInDb(id, PAID_AT, "asaas", { release: { released: true, creditDate: "2026-11-23" } });
    await markOnlinePaymentPaidInDb(id, PAID_AT, "asaas", { release: { released: false, creditDate: "2026-11-24" } });
    expect(await row(id)).toEqual({ status: "paid", funds_released: true, credit_date: "2026-11-23" });
  });
});
