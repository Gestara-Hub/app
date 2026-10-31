import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { OnlinePayment } from "@gestarahub/contracts";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";

/**
 * Revisao geral de 31/10/2026 (decisao 5, migracao 78): os codigos de pagamento
 * online sao gravados pelo servidor. E a correcao do achado S7: o cancelamento
 * no Asaas roda com quem fez a acao (o atendente que inativou o aluno) e so
 * repassa o que o banco ja marcou como cancelado.
 */

const cancelGatewayPayment = vi.fn();
vi.mock("../gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../gateway")>()),
  cancelGatewayPayment: (...args: unknown[]) => cancelGatewayPayment(...args),
  subaccountKeyOf: async () => "chave_de_teste",
}));

const { cancelGatewayPaymentsAction, cancelOnlinePaymentsForChargeInDb, insertOnlinePaymentInDb } = await import(
  "../paymentRecordsActions"
);

const admin = adminClient();
let tenant: TestTenant;
let studentId: string;
let chargeId: string;

beforeEach(async () => {
  cancelGatewayPayment.mockReset();
  cancelGatewayPayment.mockResolvedValue("canceled");
  tenant = await createTestTenant();
  studentId = randomUUID();
  chargeId = randomUUID();
  await admin
    .from("clients")
    .insert({ id: studentId, organization_id: tenant.organizationId, name: "Ana", phone: "11977770000", status: "active" })
    .throwOnError();
  await admin
    .from("charges")
    .insert({
      id: chargeId,
      organization_id: tenant.organizationId,
      student_id: studentId,
      kind: "extra",
      description: "Kimono",
      due_date: "2026-10-30",
      amount_cents: 15000,
      status: "pending",
    })
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

async function addPayment(status: "awaiting" | "canceled", gatewayPaymentId: string): Promise<string> {
  const id = randomUUID();
  await admin
    .from("online_payments")
    .insert({
      id,
      organization_id: tenant.organizationId,
      charge_id: chargeId,
      client_id: studentId,
      method: "pix",
      status,
      amount_cents: 15000,
      net_amount_cents: 15000,
      gateway_provider: "asaas",
      gateway_payment_id: gatewayPaymentId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .throwOnError();
  return id;
}

async function rowOf(id: string) {
  const { data } = await admin
    .from("online_payments")
    .select("organization_id, client_id, status, paid_at, gateway_cancel_pending")
    .eq("id", id)
    .single();
  return data;
}

describe("cancelamento no Asaas depois da gravação", () => {
  it("o atendente cancela no Asaas só o código que o banco já cancelou", async () => {
    const canceled = await addPayment("canceled", "pay_cancelado");
    const open = await addPayment("awaiting", "pay_aberto");
    await signInAs(await tenant.addUser("attendant"));
    await cancelGatewayPaymentsAction([canceled, open]);
    expect(cancelGatewayPayment).toHaveBeenCalledTimes(1);
    expect(cancelGatewayPayment).toHaveBeenCalledWith("pay_cancelado", "chave_de_teste");
    expect((await rowOf(open))?.status).toBe("awaiting");
  });

  it("falha no Asaas marca para tentar de novo", async () => {
    cancelGatewayPayment.mockResolvedValue("failed");
    const canceled = await addPayment("canceled", "pay_falhou");
    await cancelGatewayPaymentsAction([canceled]);
    expect((await rowOf(canceled))?.gateway_cancel_pending).toBe(true);
  });
});

describe("códigos gravados pelo servidor", () => {
  const payment = (overrides: Partial<OnlinePayment> = {}): OnlinePayment =>
    ({
      id: randomUUID(),
      organizationId: tenant.organizationId,
      chargeId,
      method: "pix",
      amountCents: 15000,
      status: "awaiting",
      gatewayProvider: "asaas",
      gatewayPaymentId: "pay_novo",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
      ...overrides,
    }) as OnlinePayment;

  it("o código novo fica no espaço da sessão, em aberto e com o aluno da cobrança", async () => {
    const created = payment({ organizationId: randomUUID(), status: "paid", paidAt: new Date().toISOString() });
    await insertOnlinePaymentInDb(created);
    expect(await rowOf(created.id)).toMatchObject({
      organization_id: tenant.organizationId,
      client_id: studentId,
      status: "awaiting",
      paid_at: null,
    });
  });

  it("cobrança de outro espaço não recebe código", async () => {
    await expect(insertOnlinePaymentInDb(payment({ chargeId: randomUUID() }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("sem a permissão de cobranças não grava nem cancela", async () => {
    await signInAs(await tenant.addUser("attendant"));
    await expect(insertOnlinePaymentInDb(payment())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(cancelOnlinePaymentsForChargeInDb(chargeId, tenant.organizationId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("o dono cancela os códigos em aberto da cobrança", async () => {
    const open = await addPayment("awaiting", "pay_trocado");
    await cancelOnlinePaymentsForChargeInDb(chargeId, tenant.organizationId, "Substituído por novo código");
    expect((await rowOf(open))?.status).toBe("canceled");
    expect(cancelGatewayPayment).toHaveBeenCalledWith("pay_trocado", "chave_de_teste");
  });
});
