import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import type { Subscription } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { addPlanCycle, quotePlanChange } from "@gestarahub/core/subscription-plan";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Troca de plano, renovacao e tolerancia no servidor (doc product/13 §6), com o
 * Asaas simulado: uma assinatura so por espaco, upgrade na hora pago pela
 * diferenca, reducao no fim do periodo, 5 dias de tolerancia e avisos.
 */

const asaas = vi.hoisted(() => ({
  createPixPayment: vi.fn(),
  getPixQrCode: vi.fn(),
  getPayment: vi.fn(),
  getSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  updateSubscription: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  cancelSubscription: vi.fn(),
  createSubscription: vi.fn(),
}));
const email = vi.hoisted(() => ({ sendPlanNoticeEmail: vi.fn() }));

vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
  getAsaasConfig: () => ({ apiUrl: "https://sandbox.asaas.com/api/v3", masterApiKey: "chave-de-teste" }),
}));
vi.mock("@/lib/email/ses", () => email);

const plan = await import("@/services/server/subscriptionPlan");
// Quem pediu a troca nos testes: o dono do espaco (montado no beforeEach).
let owner: { actor: { userId: string; name: string; profile: "owner" } };
const { updateOrganizationSubscriptionAction } = await import("../subscriptionActions");
const { unwrap } = await import("@/services/server/action");

let tenant: TestTenant;
const admin = adminClient();
const today = dateInSpace();
const inDays = (n: number) => format(addDays(new Date(`${today}T12:00:00`), n), "yyyy-MM-dd");

async function setSubscription(subscription: Subscription): Promise<void> {
  await admin.from("organizations").update({ subscription }).eq("id", tenant.organizationId);
}

async function subscriptionInDb(): Promise<Subscription> {
  const { data } = await admin.from("organizations").select("subscription").eq("id", tenant.organizationId).single();
  return data?.subscription as Subscription;
}

/** Historico do plano e a linha da Auditoria ligada a cada evento. */
async function historyInDb() {
  const { data: events } = await admin
    .from("subscription_events")
    .select("kind, source, actor, audit_log_id, amount_cents, asaas_payment_id")
    .eq("organization_id", tenant.organizationId)
    .order("created_at", { ascending: true });
  const { data: audits } = await admin
    .from("audit_logs")
    .select("id, summary, source, actor, target, security")
    .eq("organization_id", tenant.organizationId)
    .eq("target->>type", "subscription");
  return { events: events ?? [], audits: audits ?? [] };
}

const paidPlan = (over: Partial<Subscription> = {}): Subscription => ({
  tier: "pro",
  interval: "monthly",
  status: "active",
  paymentMethod: "pix",
  priceCents: 7990,
  asaasSubscriptionId: "sub_teste",
  asaasCustomerId: "cus_teste",
  renewsOn: inDays(20),
  ...over,
});

beforeEach(async () => {
  vi.clearAllMocks();
  tenant = await createTestTenant();
  owner = { actor: { userId: tenant.owner.id, name: "Teste owner", profile: "owner" } };
  asaas.getSubscriptionPayments.mockResolvedValue({
    data: [{ id: "pay_renovacao", status: "PENDING", value: 79.9, dueDate: inDays(20), subscription: "sub_teste" }],
  });
  asaas.getSubscription.mockResolvedValue({
    id: "sub_teste",
    externalReference: `${tenant.organizationId}:pro:monthly`,
    customer: "cus_teste",
  });
  asaas.updateSubscription.mockResolvedValue({});
  asaas.updatePayment.mockResolvedValue({});
  asaas.deletePayment.mockResolvedValue({ deleted: true });
  asaas.cancelSubscription.mockResolvedValue({ deleted: true });
  email.sendPlanNoticeEmail.mockResolvedValue({ ok: true });
});

afterEach(async () => {
  await tenant.remove();
});

describe("upgrade: na hora, pago pela diferença", () => {
  it("Pro → Scale mensal: cobra a diferença proporcional e liga ao pagar, com a renovação igual", async () => {
    await setSubscription(paidPlan());
    asaas.createPixPayment.mockResolvedValue({ id: "pay_diferenca", invoiceUrl: "https://sandbox.asaas.com/i/x" });
    asaas.getPixQrCode.mockResolvedValue({ encodedImage: "img", payload: "pix", expirationDate: inDays(1) });
    const expected = quotePlanChange(
      { tier: "pro", interval: "monthly", renewsOn: inDays(20) },
      { tier: "scale", interval: "monthly" },
      today,
      plan.PLAN_PRICES,
    );
    if (expected.kind !== "now") throw new Error("esperava upgrade na hora");

    const start = await plan.startPlanChange(admin, tenant.organizationId, { tier: "scale", interval: "monthly" }, owner);

    expect(start.kind).toBe("awaiting_payment");
    expect(asaas.createPixPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_teste",
        billingType: "UNDEFINED",
        value: expected.chargeTodayCents / 100,
        externalReference: `plan-change:${tenant.organizationId}:scale:monthly`,
      }),
    );
    // Ainda nao pago: o plano segue o mesmo.
    expect((await subscriptionInDb()).tier).toBe("pro");

    asaas.getPayment.mockResolvedValue({
      id: "pay_diferenca",
      status: "RECEIVED",
      externalReference: `plan-change:${tenant.organizationId}:scale:monthly`,
    });
    const check = await plan.confirmPlanChangePayment(admin, tenant.organizationId, "pay_diferenca");

    expect(check.isPaid).toBe(true);
    const saved = await subscriptionInDb();
    expect(saved).toMatchObject({ tier: "scale", interval: "monthly", priceCents: 19900, renewsOn: inDays(20) });
    expect(saved.pendingChange).toBeUndefined();
    // Uma assinatura so: a mesma, com o valor novo, e a renovacao ja gerada tambem.
    expect(asaas.createSubscription).not.toHaveBeenCalled();
    expect(asaas.updateSubscription).toHaveBeenCalledWith("sub_teste", expect.objectContaining({ value: 199, cycle: "MONTHLY" }));
    expect(asaas.updatePayment).toHaveBeenCalledWith("pay_renovacao", expect.objectContaining({ value: 199 }));

    // Historico: quem pediu, o valor e a cobranca, e a mesma frase na Auditoria.
    const { events, audits } = await historyInDb();
    expect(events).toHaveLength(1);
    // Quem confirmou foi o parceiro; quem pediu fica na frase.
    expect(events[0]).toMatchObject({
      kind: "upgraded",
      source: "webhook.asaas",
      amount_cents: expected.chargeTodayCents,
      asaas_payment_id: "pay_diferenca",
    });
    const audit = audits.find((a) => a.id === events[0].audit_log_id);
    expect(audit).toMatchObject({ source: "webhook.asaas", security: true });
    expect(audit?.summary).toContain("Parceiro de pagamentos mudou o Plano GestaraHub para o Expansão mensal");
    expect(audit?.summary).toContain("pedido por Teste owner");
  });

  it("mensal → anual: o ciclo anual começa no dia e a cobrança do mês sai", async () => {
    await setSubscription(paidPlan());
    asaas.createPixPayment.mockResolvedValue({ id: "pay_anual" });
    asaas.getPixQrCode.mockResolvedValue({ encodedImage: "img", payload: "pix", expirationDate: inDays(1) });
    await plan.startPlanChange(admin, tenant.organizationId, { tier: "pro", interval: "yearly" }, owner);
    asaas.getPayment.mockResolvedValue({
      id: "pay_anual",
      status: "CONFIRMED",
      externalReference: `plan-change:${tenant.organizationId}:pro:yearly`,
    });

    await plan.confirmPlanChangePayment(admin, tenant.organizationId, "pay_anual");

    const saved = await subscriptionInDb();
    expect(saved).toMatchObject({ tier: "pro", interval: "yearly", renewsOn: addPlanCycle(today, "yearly") });
    expect(asaas.deletePayment).toHaveBeenCalledWith("pay_renovacao");
    expect(asaas.updateSubscription).toHaveBeenCalledWith(
      "sub_teste",
      expect.objectContaining({ cycle: "YEARLY", value: 799, nextDueDate: addPlanCycle(today, "yearly") }),
    );
  });

  it("pagamento de outro espaço não liga o plano", async () => {
    await setSubscription(paidPlan({ pendingChange: { tier: "scale", interval: "monthly", paymentId: "pay_x", amountCents: 100, restartsCycle: false, createdAt: today } }));
    asaas.getPayment.mockResolvedValue({ id: "pay_x", status: "RECEIVED", externalReference: "plan-change:outro-espaco:scale:monthly" });
    await expect(plan.confirmPlanChangePayment(admin, tenant.organizationId, "pay_x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await subscriptionInDb()).tier).toBe("pro");
  });
});

describe("redução: no fim do período pago", () => {
  it("Scale → Pro: fica marcada, a renovação já sai com o valor novo e dá para desmarcar", async () => {
    await setSubscription(paidPlan({ tier: "scale", priceCents: 19900 }));

    const start = await plan.startPlanChange(admin, tenant.organizationId, { tier: "pro", interval: "monthly" }, owner);

    expect(start.kind).toBe("scheduled");
    const saved = await subscriptionInDb();
    expect(saved.tier).toBe("scale");
    expect(saved.scheduledChange).toEqual({ tier: "pro", interval: "monthly", effectiveOn: inDays(20) });
    expect(asaas.updateSubscription).toHaveBeenLastCalledWith("sub_teste", expect.objectContaining({ value: 79.9 }));

    await plan.cancelScheduledPlanChange(admin, tenant.organizationId, owner);
    expect((await subscriptionInDb()).scheduledChange).toBeUndefined();
    expect(asaas.updateSubscription).toHaveBeenLastCalledWith("sub_teste", expect.objectContaining({ value: 199 }));
  });

  it("voltar ao Grátis: encerra no Asaas, o plano segue até o fim e desmarcar recria a assinatura", async () => {
    await setSubscription(paidPlan());
    await plan.startPlanChange(admin, tenant.organizationId, { tier: "free", interval: "monthly" }, owner);

    expect(asaas.cancelSubscription).toHaveBeenCalledWith("sub_teste");
    expect(await subscriptionInDb()).toMatchObject({ tier: "pro", scheduledChange: { tier: "free", effectiveOn: inDays(20) } });
    // O aviso de assinatura removida (que nos mesmos pedimos) nao derruba o plano antes da hora.
    expect(await plan.recordSubscriptionRemoved(admin, { id: "sub_teste" })).toBe(false);

    asaas.createSubscription.mockResolvedValue({ id: "sub_nova" });
    await plan.cancelScheduledPlanChange(admin, tenant.organizationId, owner);
    expect(asaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_teste", nextDueDate: inDays(20), cycle: "MONTHLY", value: 79.9 }),
    );
    expect(await subscriptionInDb()).toMatchObject({ tier: "pro", asaasSubscriptionId: "sub_nova" });
  });

  it("a troca direta para o Grátis com dias pagos fica marcada, não corta na hora", async () => {
    await setSubscription(paidPlan());
    const saved = await unwrap(updateOrganizationSubscriptionAction(tenant.organizationId, "free"));
    expect(saved).toMatchObject({ tier: "pro", scheduledChange: { tier: "free", effectiveOn: inDays(20) } });
  });

  it("a rotina aplica a troca marcada no dia", async () => {
    await setSubscription(paidPlan({ tier: "scale", renewsOn: today, scheduledChange: { tier: "pro", interval: "monthly", effectiveOn: today } }));
    asaas.getSubscriptionPayments.mockResolvedValue({ data: [] });

    const result = await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });

    expect(result.applied).toBe(1);
    expect(await subscriptionInDb()).toMatchObject({ tier: "pro", priceCents: 7990 });
  });
});

describe("renovação e tolerância de 5 dias", () => {
  it("renovação paga empurra a data; no 5º dia sem pagar volta ao Grátis; pagar depois religa", async () => {
    await setSubscription(paidPlan({ renewsOn: inDays(-5) }));
    asaas.getSubscriptionPayments.mockResolvedValue({ data: [] });

    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });
    const reverted = await subscriptionInDb();
    expect(reverted).toMatchObject({ tier: "free", revertedFrom: { tier: "pro", on: inDays(-5) } });
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(expect.objectContaining({ title: "Seu plano voltou ao Grátis" }));

    await plan.recordSubscriptionPaymentPaid(admin, { id: "pay_atrasada", dueDate: inDays(-5), subscription: "sub_teste" });
    expect(await subscriptionInDb()).toMatchObject({ tier: "pro", status: "active", renewsOn: addPlanCycle(inDays(-5), "monthly") });

    // Sem pessoa: a rotina voltou ao Gratis, o parceiro religou.
    const { events, audits } = await historyInDb();
    expect(events.map((e) => [e.kind, e.source])).toEqual([
      ["reverted_to_free", "cron.daily"],
      ["reactivated", "webhook.asaas"],
    ]);
    const revertAudit = audits.find((a) => a.id === events[0].audit_log_id);
    expect(revertAudit?.actor).toMatchObject({ kind: "system", name: "Rotina diária" });
    expect(revertAudit?.summary).toContain("Rotina diária voltou o espaço ao Grátis");
  });

  it("15 dias depois de voltar ao Grátis, encerra a assinatura no Asaas e avisa", async () => {
    // Renovacao de 20 dias atras: Gratis no 5º dia, encerramento 15 dias depois (hoje).
    await setSubscription({ ...paidPlan(), tier: "free", revertedFrom: { tier: "pro", interval: "monthly", on: inDays(-20) } });

    const result = await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });

    expect(result.closed).toBe(1);
    expect(asaas.cancelSubscription).toHaveBeenCalledWith("sub_teste");
    const saved = await subscriptionInDb();
    expect(saved).toMatchObject({ tier: "free", closedFrom: { tier: "pro", renewsOn: inDays(-20), on: today } });
    expect(saved.asaasSubscriptionId).toBeUndefined();
    expect(saved.revertedFrom).toBeUndefined();
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A assinatura do plano foi encerrada", actionUrl: "https://app.test/plans" }),
    );

    // No dia seguinte, nada de novo.
    email.sendPlanNoticeEmail.mockClear();
    asaas.cancelSubscription.mockClear();
    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });
    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
    expect(email.sendPlanNoticeEmail).not.toHaveBeenCalled();
  });

  it("no meio dos 15 dias, o lembrete explica o encerramento", async () => {
    await setSubscription({ ...paidPlan(), tier: "free", revertedFrom: { tier: "pro", interval: "monthly", on: inDays(-12) } });

    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });

    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("A assinatura do plano será encerrada em") }),
    );
  });

  it("aviso por e-mail uma vez por renovação, ao dono e ao gerente", async () => {
    await tenant.addUser("manager");
    await tenant.addUser("attendant");
    await setSubscription(paidPlan({ renewsOn: today }));
    asaas.getSubscriptionPayments.mockResolvedValue({ data: [] });

    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });
    const mine = email.sendPlanNoticeEmail.mock.calls;
    expect(mine).toHaveLength(2);
    expect(mine[0][0]).toMatchObject({ title: "Pagamento do plano pendente" });

    email.sendPlanNoticeEmail.mockClear();
    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });
    expect(email.sendPlanNoticeEmail).not.toHaveBeenCalled();
  });

  it("sem webhook, a rotina acha a renovação paga no Asaas", async () => {
    await setSubscription(paidPlan({ renewsOn: today }));
    asaas.getSubscriptionPayments.mockResolvedValue({
      data: [{ id: "pay_paga", status: "RECEIVED", value: 79.9, dueDate: today, subscription: "sub_teste" }],
    });

    await plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });

    expect(await subscriptionInDb()).toMatchObject({ tier: "pro", renewsOn: addPlanCycle(today, "monthly") });
  });
});
