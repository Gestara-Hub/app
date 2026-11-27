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
const runs = vi.hoisted(() => ({ beginWebhookEvent: vi.fn(), finishWebhookEvent: vi.fn() }));
const audit = vi.hoisted(() => ({ auditOnlinePaymentPaid: vi.fn() }));

vi.mock("@/services/server/subscriptionPlan", () => plan);
vi.mock("@/services/onlinePayments/asaasSettlement", () => settlement);
vi.mock("@/services/onlinePayments/onlinePaymentsWebhook", () => ({
  expireOnlinePaymentInDb: vi.fn(),
  cancelOnlinePaymentByGatewayIdInDb: vi.fn(),
}));
const gateway = vi.hoisted(() => ({
  recheckFeesAfterPayment: vi.fn(async () => undefined),
  verifyGatewayPaymentForWebhook: vi.fn(async (_admin: unknown, p: unknown) => ({ ok: true as const, payment: p })),
}));
vi.mock("@/services/onlinePayments/gateway", () => gateway);
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/services/server/backgroundRuns", () => runs);
// `after` so existe numa requisicao do Next: aqui roda na hora.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));
vi.mock("@/services/onlinePayments/onlinePaymentAudit", () => audit);
const accountStatus = vi.hoisted(() => ({ recordAccountStatusFromWebhook: vi.fn() }));
vi.mock("@/services/onlinePayments/accountStatus", () => accountStatus);
const apiKey = vi.hoisted(() => ({ recordApiKeyEvent: vi.fn() }));
vi.mock("@/services/onlinePayments/apiKeyHealth", () => apiKey);
vi.mock("@/lib/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log")>()),
  reportError: vi.fn(async () => "CODIGO01"),
}));

const { AsaasApiError } = await import("@/lib/asaas");
const { POST } = await import("@/app/api/webhooks/asaas/route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/webhooks/asaas", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ASAAS_WEBHOOK_SECRET;
  settlement.settleAsaasPayment.mockResolvedValue(null);
  gateway.verifyGatewayPaymentForWebhook.mockImplementation(async (_admin: unknown, p: unknown) => ({ ok: true as const, payment: p }));
  runs.beginWebhookEvent.mockResolvedValue({ id: "linha-1", duplicate: false });
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

  it("aviso repetido, já tratado, só é reconhecido", async () => {
    runs.beginWebhookEvent.mockResolvedValue({ id: "linha-1", duplicate: true });
    const res = await post({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_6" } });
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(settlement.settleAsaasPayment).not.toHaveBeenCalled();
    expect(runs.beginWebhookEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: "evt_1" }));
  });

  it("pagamento de aluno: baixa, Auditoria uma vez e o aviso registrado", async () => {
    settlement.settleAsaasPayment.mockResolvedValue({
      payment: { organizationId: "org", amountCents: 15000 },
      chargeId: "c1",
      newlyPaid: true,
    });
    await post({ id: "evt_2", event: "PAYMENT_RECEIVED", payment: { id: "pay_7" } });
    expect(audit.auditOnlinePaymentPaid).toHaveBeenCalledTimes(1);
    expect(runs.finishWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      "linha-1",
      expect.objectContaining({ status: "processed", organizationId: "org" }),
    );

    // O mesmo pagamento avisado de novo (cartao: "recebido" depois de "confirmado").
    settlement.settleAsaasPayment.mockResolvedValue({ payment: { organizationId: "org" }, chargeId: "c1", newlyPaid: false });
    await post({ id: "evt_3", event: "PAYMENT_RECEIVED", payment: { id: "pay_7" } });
    expect(audit.auditOnlinePaymentPaid).toHaveBeenCalledTimes(1);
  });

  it("falha: responde 500 (o Asaas tenta de novo) e o aviso fica com o código do erro", async () => {
    settlement.settleAsaasPayment.mockRejectedValue(new Error("banco fora"));
    const res = await post({ id: "evt_4", event: "PAYMENT_RECEIVED", payment: { id: "pay_8" } });
    expect(res.status).toBe(500);
    expect(runs.finishWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      "linha-1",
      { status: "failed", errorReference: "CODIGO01" },
    );
  });

  it("pagamento de aluno não confirmado na reconferência do Asaas é ignorado sem dar baixa", async () => {
    gateway.verifyGatewayPaymentForWebhook.mockResolvedValueOnce({ ok: false, status: "PENDING" } as never);
    const res = await post({ id: "evt_fake", event: "PAYMENT_RECEIVED", payment: { id: "pay_fake" } });
    expect(await res.json()).toMatchObject({ processed: false });
    expect(settlement.settleAsaasPayment).not.toHaveBeenCalled();
    expect(runs.finishWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      "linha-1",
      expect.objectContaining({ status: "ignored" }),
    );
  });

  it("aviso que a rota ainda não trata (saque): 200 e registrado como ignorado, sem pausar a fila", async () => {
    const res = await post({ id: "evt_1", event: "TRANSFER_DONE", transfer: { id: "tra_1", status: "DONE" } });
    expect(res.status).toBe(200);
    expect(runs.finishWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      "linha-1",
      expect.objectContaining({ status: "ignored", outcome: "TRANSFER_DONE: ainda não tratado" }),
    );
  });

  it("chave de API da subconta (27/11/2026): vai para a situação da chave do espaço", async () => {
    apiKey.recordApiKeyEvent.mockResolvedValue({ organizationId: "org_1", outcome: "chave da subconta expirou" });
    const token = await post({ id: "evt_2", event: "ACCESS_TOKEN_EXPIRED", account: { id: "acc_1" }, accessToken: { id: "tok_1" } });
    expect(token.status).toBe(200);
    expect(await token.json()).toMatchObject({ processed: true });
    expect(apiKey.recordApiKeyEvent).toHaveBeenCalledWith(expect.anything(), "acc_1", "ACCESS_TOKEN_EXPIRED", { id: "tok_1" });
    expect(accountStatus.recordAccountStatusFromWebhook).not.toHaveBeenCalled();
  });

  it("sem o nome do evento: recusa", async () => {
    const res = await post({ payment: { id: "pay_x" } });
    expect(res.status).toBe(400);
  });

  it("análise da conta: vai para a situação do espaço", async () => {
    accountStatus.recordAccountStatusFromWebhook.mockResolvedValue("org_1");
    const res = await post({
      id: "evt_3",
      event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
      account: { id: "acc_1", ownerId: null },
      accountStatus: { general: "APPROVED", documentation: "APPROVED" },
    });
    expect(await res.json()).toMatchObject({ processed: true });
    expect(accountStatus.recordAccountStatusFromWebhook).toHaveBeenCalledWith(expect.anything(), "acc_1", {
      general: "APPROVED",
      documentation: "APPROVED",
    });
  });
});
