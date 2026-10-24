import { beforeEach, describe, expect, it, vi } from "vitest";

// Webhook do Asaas (doc product/13 §6): cobrancas do Plano GestaraHub vao para
// a assinatura; as de aluno (subconta) seguem o fluxo de sempre.

const plan = vi.hoisted(() => ({
  recordPlanChangePaymentPaid: vi.fn(),
  recordSubscriptionPaymentOpen: vi.fn(),
  recordSubscriptionPaymentPaid: vi.fn(),
  recordSubscriptionRemoved: vi.fn(),
}));
const settlement = vi.hoisted(() => ({ settleAsaasPayment: vi.fn() }));

vi.mock("@/services/server/subscriptionPlan", () => plan);
vi.mock("@/services/onlinePayments/asaasSettlement", () => settlement);
vi.mock("@/services/onlinePayments/onlinePaymentsWebhook", () => ({
  expireOnlinePaymentInDb: vi.fn(),
  cancelOnlinePaymentByGatewayIdInDb: vi.fn(),
}));
vi.mock("@/services/onlinePayments/gateway", () => ({ recheckFeesAfterPayment: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));

const { AsaasApiError } = await import("@/lib/asaas");
const { POST } = await import("@/app/api/webhooks/asaas/route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/webhooks/asaas", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ASAAS_WEBHOOK_SECRET;
  settlement.settleAsaasPayment.mockResolvedValue(null);
});

describe("webhook do Asaas e o Plano GestaraHub", () => {
  it("renovação paga vai para a assinatura, não para as cobranças de aluno", async () => {
    plan.recordSubscriptionPaymentPaid.mockResolvedValue({ organizationId: "org" });
    const res = await post({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: "sub_1", dueDate: "2026-11-13" } });
    expect(await res.json()).toMatchObject({ processed: true });
    expect(plan.recordSubscriptionPaymentPaid).toHaveBeenCalled();
    expect(settlement.settleAsaasPayment).not.toHaveBeenCalled();
  });

  it("diferença do upgrade paga liga a troca", async () => {
    plan.recordPlanChangePaymentPaid.mockResolvedValue(true);
    await post({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_2", externalReference: "plan-change:org:scale:monthly" } });
    expect(plan.recordPlanChangePaymentPaid).toHaveBeenCalled();
    expect(settlement.settleAsaasPayment).not.toHaveBeenCalled();
  });

  it("renovação vencida guarda a cobrança em aberto", async () => {
    plan.recordSubscriptionPaymentOpen.mockResolvedValue(true);
    await post({ event: "PAYMENT_OVERDUE", payment: { id: "pay_3", subscription: "sub_1", dueDate: "2026-11-13" } });
    expect(plan.recordSubscriptionPaymentOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "pay_3" }), true);
  });

  it("cobrança de aluno (sem assinatura) segue o fluxo de sempre", async () => {
    await post({ event: "PAYMENT_RECEIVED", payment: { id: "pay_4" } });
    expect(settlement.settleAsaasPayment).toHaveBeenCalled();
    expect(plan.recordSubscriptionPaymentPaid).not.toHaveBeenCalled();
  });

  it("assinatura que a conta principal não conhece também segue o fluxo de sempre", async () => {
    plan.recordSubscriptionPaymentPaid.mockRejectedValue(new AsaasApiError("Não encontrado", 404));
    await post({ event: "PAYMENT_RECEIVED", payment: { id: "pay_5", subscription: "sub_de_subconta" } });
    expect(settlement.settleAsaasPayment).toHaveBeenCalled();
  });

  it("assinatura removida direto no Asaas avisa o plano", async () => {
    plan.recordSubscriptionRemoved.mockResolvedValue(true);
    const res = await post({ event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } });
    expect(await res.json()).toMatchObject({ processed: true });
    expect(plan.recordSubscriptionRemoved).toHaveBeenCalledWith(expect.anything(), { id: "sub_1" });
  });
});
