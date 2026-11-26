import { beforeEach, describe, expect, it } from "vitest";
import type { OnlinePayment } from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { createPlan, enrollStudent, resetAcademy } from "@/test/academy";

// Devolucao de pagamento (26/11/2026, doc product/15 "Estorno de pagamento").
// Hoje = 22/09/2026 (src/test/setup.ts). Academia de demonstracao: o estorno online acontece no proprio servico.

async function paidCharge() {
  const plan = await createPlan("monthly", 15000);
  const s = await enrollStudent({ plan, startDate: "2026-09-20" });
  const [charge] = await billingService.listCharges({ studentId: s.id });
  await billingService.markPaid(charge.id, "pix");
  return charge.id;
}

function payOnline(chargeId: string): OnlinePayment {
  const c = store.charges.find((x) => x.id === chargeId)!;
  c.status = "paid";
  c.paidVia = "online";
  c.method = "card";
  c.paidAt = "2026-09-21T12:00:00.000Z";
  const payment: OnlinePayment = {
    id: `op-${chargeId}`,
    chargeId,
    method: "link",
    amountCents: c.amountCents,
    status: "paid",
    expiresAt: "2026-09-30T00:00:00.000Z",
    paidAt: c.paidAt,
    createdAt: "2026-09-21T11:00:00.000Z",
  };
  store.onlinePayments.push(payment);
  return payment;
}

describe("estornar pagamento", () => {
  beforeEach(() => resetAcademy());

  it("fora do app, reabrir: volta em aberto e guarda o estorno e o pagamento estornado", async () => {
    const id = await paidCharge();
    const view = await billingService.refundCharge({
      chargeId: id,
      outcome: "reopened",
      method: "pix",
      refundedOn: "2026-09-22",
      reason: "Trocou a forma de pagamento",
    });
    expect(view.status).toBe("overdue"); // venceu 20/09: aberto e lido como atrasado
    expect(view.paidAt).toBeUndefined();
    expect(view.refunds).toHaveLength(1);
    expect(view.refunds?.[0]).toMatchObject({
      via: "manual",
      method: "pix",
      refundedOn: "2026-09-22",
      paidMethod: "pix",
      outcome: "reopened",
      reason: "Trocou a forma de pagamento",
    });
  });

  it("encerrar: fica Estornada e sai do Recebido", async () => {
    const id = await paidCharge();
    const view = await billingService.refundCharge({ chargeId: id, outcome: "closed", method: "cash" });
    expect(view.status).toBe("refunded");
    const paid = await billingService.listCharges({ status: "paid" });
    expect(paid.some((c) => c.id === id)).toBe(false);
  });

  it("só cobrança paga; data futura recusada", async () => {
    const id = await paidCharge();
    await expect(
      billingService.refundCharge({ chargeId: id, outcome: "closed", method: "pix", refundedOn: "2026-09-30" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await billingService.refundCharge({ chargeId: id, outcome: "closed", method: "pix" });
    await expect(billingService.refundCharge({ chargeId: id, outcome: "reopened" })).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("pago online: marca o pagamento como estornado e resolvido (o aviso some)", async () => {
    const id = await paidCharge();
    const payment = payOnline(id);
    const view = await billingService.refundCharge({ chargeId: id, outcome: "reopened" });
    expect(view.refunds?.[0]).toMatchObject({ via: "online", onlinePaymentId: payment.id, paidVia: "online", amountCents: payment.amountCents });
    const stored = store.onlinePayments.find((p) => p.id === payment.id)!;
    expect(stored.disputeStatus).toBe("refunded");
    expect(stored.refundHandledAt).toBeTruthy();
  });

  it("estorno já feito no Asaas: resolve sem pedir outro", async () => {
    const id = await paidCharge();
    const payment = payOnline(id);
    payment.disputeStatus = "refunded";
    payment.disputedAt = "2026-09-22T09:00:00.000Z";
    const view = await billingService.refundCharge({ chargeId: id, outcome: "closed" });
    expect(view.status).toBe("refunded");
    expect(store.onlinePayments.find((p) => p.id === payment.id)?.refundHandledAt).toBeTruthy();
  });
});

describe("taxas do pagamento estornado no Financeiro", () => {
  const base: OnlinePayment = {
    id: "op-x",
    chargeId: "ch-x",
    method: "link",
    amountCents: 5600,
    status: "paid",
    gatewayFeeCents: 160,
    splitAmountCents: 129,
    expiresAt: "2026-09-30T00:00:00.000Z",
    paidAt: "2026-09-21T12:00:00.000Z",
    createdAt: "2026-09-21T11:00:00.000Z",
  };

  it("cartão estornado: as taxas voltam, nada sai; Pix estornado: fica só a tarifa do parceiro", async () => {
    const { onlineFeeCents } = await import("@/services/finance/cashFlowSources");
    expect(onlineFeeCents({ ...base, paidMethod: "creditCard" }, undefined)).toBe(289);
    expect(onlineFeeCents({ ...base, paidMethod: "creditCard", disputeStatus: "refunded" }, undefined)).toBe(0);
    expect(
      onlineFeeCents({ ...base, method: "pix", paidMethod: "pix", gatewayFeeCents: 99, splitAmountCents: 199, disputeStatus: "refunded" }, undefined),
    ).toBe(99);
  });
});
