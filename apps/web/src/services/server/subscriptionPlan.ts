import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingPlanChange, Subscription, SubscriptionInterval } from "@gestarahub/contracts";
import { apiError, validationError } from "@gestarahub/core/api-error";
import { dateInSpace, resolveSpaceTimeZone } from "@gestarahub/core/date";
import {
  addPlanCycle,
  planDailyStep,
  planNoticeKey,
  planPriceCents,
  quotePlanChange,
  type CurrentPlan,
  type PaidPlanTier,
  type PlanChangeQuote,
  type PlanChoice,
  type PlanPrices,
} from "@gestarahub/core/subscription-plan";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";
import {
  AsaasApiError,
  asaasToday,
  cancelSubscription,
  createPixPayment,
  createSubscription,
  deletePayment,
  getAsaasConfig,
  getPayment,
  getPixQrCode,
  getSubscription,
  getSubscriptionPayments,
  listSubscriptionPixAutomaticAuthorizations,
  updatePayment,
  updateSubscription,
  type AsaasPaymentResponse,
  type AsaasPixAutomaticAuthorization,
  type AsaasSubscriptionResponse,
} from "@/lib/asaas";
import { notifyPlanManagers, notifyPlanPaid, planEmailAppUrl } from "./planEmails";
import {
  cancelPlanInvoiceOfPayment,
  queuePlanInvoice,
  retryFailedPlanInvoices,
  subscriptionInvoiceDescription,
  upgradeInvoiceDescription,
} from "./subscriptionInvoices";
import { subscriptionTierLabel } from "@/lib/labels";
import { logWarn, reportError } from "@/lib/log";
import { formatCents } from "@gestarahub/core/format";
import { recordSystemAudit } from "./systemAudit";
import { planNoticeCopy } from "@/lib/plan-notice-copy";
import {
  decodePlanChangeReference,
  decodeSubscriptionReference,
  encodePlanChangeReference,
  encodeSubscriptionReference,
} from "@/lib/subscription";
import { confirmSubscriptionPayment, readOrganizationSubscription, writeOrganizationSubscription } from "./subscription";
import { recordSubscriptionEvent, systemAuthor, type PlanAuthor } from "./subscriptionEvents";

/**
 * Troca de plano, renovacao e tolerancia do Plano GestaraHub no servidor (doc
 * product/13 §6). As regras sao as de `@gestarahub/core/subscription-plan`;
 * aqui elas viram chamadas ao Asaas (uma assinatura so por espaco) e gravacoes
 * no banco. Modulo so do servidor, sem "use server".
 */

export const PLAN_PRICES: PlanPrices = {
  pro: { monthly: SUBSCRIPTION_PRICES.pro.monthly.priceCents, yearly: SUBSCRIPTION_PRICES.pro.yearly.priceCents },
  scale: { monthly: SUBSCRIPTION_PRICES.scale.monthly.priceCents, yearly: SUBSCRIPTION_PRICES.scale.yearly.priceCents },
};

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const OPEN_STATUSES = ["PENDING", "OVERDUE"];
const MOCK_CHANGE_PREFIX = "pay_mock_change_";

export function currentPlanOf(subscription: Subscription | undefined): CurrentPlan {
  return {
    tier: subscription?.tier ?? "free",
    interval: subscription?.interval ?? "monthly",
    renewsOn: subscription?.renewsOn ?? subscription?.nextDueDate,
  };
}

/** A assinatura existe de verdade no Asaas (nao e a simulada sem chave). */
function onAsaas(subscription: Subscription | undefined): subscription is Subscription & { asaasSubscriptionId: string } {
  const id = subscription?.asaasSubscriptionId;
  return Boolean(getAsaasConfig().masterApiKey && id && !id.startsWith("sub_mock_"));
}

/** Sem chave do Asaas, a troca simulada so roda fora de producao. */
function assertCanSimulate(): void {
  if (process.env.NODE_ENV === "production") {
    throw apiError("NETWORK", "A troca de plano está indisponível no momento.", { httpStatus: 503 });
  }
}

/** "13/11" de "2026-11-13". */
const ddmm = (date: string | undefined) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "");
/** "Profissional mensal", "Grátis". */
function planName(subscription: Pick<Subscription, "tier" | "interval"> | undefined): string {
  if (!subscription || subscription.tier === "free") return "Grátis";
  return `${subscriptionTierLabel(subscription.tier)} ${subscription.interval === "yearly" ? "anual" : "mensal"}`;
}

const cycleOf = (interval: SubscriptionInterval) => (interval === "yearly" ? "YEARLY" : "MONTHLY") as "YEARLY" | "MONTHLY";
const reais = (cents: number) => Math.round(cents) / 100;

function priceConfig(plan: { tier: PaidPlanTier; interval: SubscriptionInterval }) {
  return SUBSCRIPTION_PRICES[plan.tier][plan.interval];
}

async function openSubscriptionPayments(subscriptionId: string): Promise<AsaasPaymentResponse[]> {
  const { data } = await getSubscriptionPayments(subscriptionId);
  return (data ?? []).filter((p) => !p.deleted && OPEN_STATUSES.includes(p.status));
}

/**
 * Leva o plano para a assinatura do Asaas: valor, ciclo e referencia, tambem
 * nas cobrancas ja geradas (o Asaas cria a proxima 40 dias antes). `restart`
 * (mensal → anual) apaga a cobranca do mes que nao vai mais existir e muda o
 * proximo vencimento.
 */
async function syncAsaasPlan(
  organizationId: string,
  subscriptionId: string,
  plan: { tier: PaidPlanTier; interval: SubscriptionInterval },
  restart?: { nextDueDate: string },
): Promise<void> {
  const config = priceConfig(plan);
  const open = await openSubscriptionPayments(subscriptionId);
  // Em paralelo (19/11/2026: antes uma cobranca por vez, com a tela esperando).
  if (restart) await Promise.all(open.map((payment) => deletePayment(payment.id)));
  await updateSubscription(subscriptionId, {
    value: config.value,
    cycle: cycleOf(plan.interval),
    description: config.description,
    externalReference: encodeSubscriptionReference(organizationId, plan.tier, plan.interval),
    updatePendingPayments: true,
    ...(restart ? { nextDueDate: restart.nextDueDate } : {}),
  });
  if (restart) return;
  // A cobranca ja gerada leva o valor novo (o PUT da assinatura nem sempre a alcanca).
  await Promise.all(
    open
      .filter((payment) => payment.value !== config.value)
      .map(async (payment) => {
        try {
          await updatePayment(payment.id, { value: config.value, description: config.description });
        } catch (error) {
          logWarn("[subscriptionPlan] Cobrança da renovação não atualizada no Asaas:", { paymentId: payment.id, error });
        }
      }),
  );
}

export interface PlanChangePreview {
  quote: PlanChangeQuote;
  current: CurrentPlan;
  /** Pix Automatico ativo: trocar valor ou ciclo desliga a autorizacao (regra do Asaas). */
  pixAutomaticActive?: boolean;
}

/** A conta da troca, para a confirmacao na tela. Nada e cobrado. */
export async function previewPlanChange(
  admin: SupabaseClient,
  organizationId: string,
  target: PlanChoice,
): Promise<PlanChangePreview> {
  const subscription = await readOrganizationSubscription(admin, organizationId);
  const current = currentPlanOf(subscription);
  return {
    current,
    quote: quotePlanChange(current, target, dateInSpace(), PLAN_PRICES),
    pixAutomaticActive: subscription?.pixAutomatic?.status === "ACTIVE",
  };
}

export type PlanChangeStart =
  | { kind: "scheduled"; subscription: Subscription }
  | { kind: "applied"; subscription: Subscription }
  | {
      kind: "awaiting_payment";
      subscription: Subscription;
      payment: {
        id: string;
        amountCents: number;
        pixQrCode?: { encodedImage: string; payload: string; expirationDate: string };
        invoiceUrl?: string;
      };
    };

/**
 * Faz a troca: o que reduz fica marcado para o fim do periodo; o que aumenta
 * gera a cobranca avulsa da diferenca e liga quando ela e paga.
 */
export async function startPlanChange(
  admin: SupabaseClient,
  organizationId: string,
  target: PlanChoice,
  author: PlanAuthor,
): Promise<PlanChangeStart> {
  const subscription = await readOrganizationSubscription(admin, organizationId);
  if (!subscription || subscription.tier === "free") {
    throw apiError("CONFLICT", "Sem plano pago: assine pelo checkout.", { httpStatus: 409 });
  }
  if (subscription.status === "past_due") {
    throw apiError("CONFLICT", "Pague a renovação em aberto antes de trocar de plano.", { httpStatus: 409 });
  }
  const current = currentPlanOf(subscription);
  const today = dateInSpace();
  const quote = quotePlanChange(current, target, today, PLAN_PRICES);

  if (quote.kind === "same") throw validationError([{ field: "tier", message: "Esse já é o seu plano." }]);
  if (quote.kind === "checkout") throw apiError("CONFLICT", "Sem plano pago: assine pelo checkout.", { httpStatus: 409 });

  if (quote.kind === "scheduled") {
    if (onAsaas(subscription)) {
      if (target.tier === "free") await cancelOnAsaas(subscription.asaasSubscriptionId);
      else await syncAsaasPlan(organizationId, subscription.asaasSubscriptionId, { tier: target.tier, interval: target.interval });
    } else if (subscription.asaasSubscriptionId && !subscription.asaasSubscriptionId.startsWith("sub_mock_")) {
      assertCanSimulate();
    }
    const next: Subscription = {
      ...subscription,
      scheduledChange: {
        tier: target.tier,
        ...(target.tier === "free" ? {} : { interval: target.interval }),
        effectiveOn: quote.effectiveOn,
      },
      pendingChange: undefined,
    };
    await writeOrganizationSubscription(admin, organizationId, next);
    await recordSubscriptionEvent(admin, organizationId, author, {
      kind: "change_scheduled",
      before: subscription,
      after: next,
      effectiveOn: quote.effectiveOn,
      predicate: `marcou a troca do Plano GestaraHub para o ${planName(target)} em ${ddmm(quote.effectiveOn)}`,
      details: { targetTier: target.tier, targetInterval: target.interval },
    });
    return { kind: "scheduled", subscription: next };
  }

  const paidTarget = { tier: target.tier as PaidPlanTier, interval: target.interval };
  const pending: Omit<PendingPlanChange, "paymentId"> = {
    ...paidTarget,
    amountCents: quote.chargeTodayCents,
    restartsCycle: quote.restartsCycle,
    createdAt: new Date().toISOString(),
    ...(author.source ? {} : { requestedBy: { userId: author.actor.userId, name: author.actor.name } }),
  };

  if (quote.chargeTodayCents === 0) {
    const applied = await applyUpgrade(admin, organizationId, subscription, { ...pending, paymentId: "" }, author);
    return { kind: "applied", subscription: applied };
  }

  if (!onAsaas(subscription)) {
    assertCanSimulate();
    const paymentId = `${MOCK_CHANGE_PREFIX}${Date.now()}`;
    const next: Subscription = { ...subscription, pendingChange: { ...pending, paymentId }, scheduledChange: undefined };
    await writeOrganizationSubscription(admin, organizationId, next);
    return { kind: "awaiting_payment", subscription: next, payment: { id: paymentId, amountCents: quote.chargeTodayCents } };
  }

  if (!subscription.asaasCustomerId) {
    throw apiError("CONFLICT", "Assinatura sem cliente no parceiro de pagamentos.", { httpStatus: 409 });
  }
  const description = `Diferença: ${priceConfig(paidTarget).description}`;
  // Pix ou cartao na fatura do Asaas (UNDEFINED): a pessoa escolhe.
  const payment = await createPixPayment({
    customer: subscription.asaasCustomerId,
    billingType: "UNDEFINED",
    value: reais(quote.chargeTodayCents),
    dueDate: asaasToday(),
    description,
    externalReference: encodePlanChangeReference(organizationId, paidTarget.tier, paidTarget.interval),
  });
  let pixQrCode: { encodedImage: string; payload: string; expirationDate: string } | undefined;
  try {
    const qr = await getPixQrCode(payment.id);
    pixQrCode = { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate };
  } catch (error) {
    logWarn("[subscriptionPlan] Pix da diferença sem QR; segue com a fatura:", error);
  }
  // Uma diferenca em aberto por vez: a anterior sai do Asaas.
  if (subscription.pendingChange?.paymentId && !subscription.pendingChange.paymentId.startsWith(MOCK_CHANGE_PREFIX)) {
    await deletePayment(subscription.pendingChange.paymentId).catch((error: unknown) =>
      logWarn("[subscriptionPlan] Diferença anterior não removida do Asaas:", error),
    );
  }
  const next: Subscription = { ...subscription, pendingChange: { ...pending, paymentId: payment.id }, scheduledChange: undefined };
  await writeOrganizationSubscription(admin, organizationId, next);
  return {
    kind: "awaiting_payment",
    subscription: next,
    payment: { id: payment.id, amountCents: quote.chargeTodayCents, pixQrCode, invoiceUrl: payment.invoiceUrl },
  };
}

async function cancelOnAsaas(subscriptionId: string): Promise<void> {
  try {
    await cancelSubscription(subscriptionId);
  } catch (error) {
    if (error instanceof AsaasApiError && error.status === 404) return;
    throw error;
  }
}

/** Upgrade pago: liga o plano novo e leva valor e ciclo para o Asaas. */
async function applyUpgrade(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
  pending: PendingPlanChange,
  author: PlanAuthor,
): Promise<Subscription> {
  const today = dateInSpace();
  const current = currentPlanOf(subscription);
  const renewsOn = pending.restartsCycle ? addPlanCycle(today, "yearly") : (current.renewsOn ?? today);
  if (onAsaas(subscription)) {
    await syncAsaasPlan(
      organizationId,
      subscription.asaasSubscriptionId,
      { tier: pending.tier, interval: pending.interval },
      pending.restartsCycle ? { nextDueDate: renewsOn } : undefined,
    );
  }
  const next: Subscription = {
    ...subscription,
    tier: pending.tier,
    interval: pending.interval,
    status: "active",
    priceCents: planPriceCents(PLAN_PRICES, pending),
    renewsOn,
    nextDueDate: renewsOn,
    pendingChange: undefined,
    scheduledChange: undefined,
    changedAt: new Date().toISOString(),
    ...(pending.restartsCycle ? { noticesSent: [] } : {}),
  };
  await writeOrganizationSubscription(admin, organizationId, next);
  await recordSubscriptionEvent(admin, organizationId, author, {
    kind: "upgraded",
    before: subscription,
    after: next,
    amountCents: pending.amountCents,
    paymentId: pending.paymentId || undefined,
    effectiveOn: renewsOn,
    predicate: [
      `mudou o Plano GestaraHub para o ${planName(next)}`,
      pending.amountCents > 0 ? ` (diferença de ${formatCents(pending.amountCents)} paga` : "",
      // Confirmado pelo parceiro: quem pediu fica na frase.
      pending.amountCents > 0 && author.source && pending.requestedBy ? `, pedido por ${pending.requestedBy.name})` : pending.amountCents > 0 ? ")" : "",
    ].join(""),
    ...(pending.requestedBy ? { details: { requestedBy: pending.requestedBy } } : {}),
  });
  // Nota so da diferenca paga, mesmo codigo do servico (contabilidade, 22/11/2026).
  if (pending.amountCents > 0 && pending.paymentId) {
    await queuePlanInvoice(admin, {
      organizationId,
      kind: "plan_upgrade",
      payment: { id: pending.paymentId, value: pending.amountCents / 100 },
      serviceDescription: upgradeInvoiceDescription(next, today, renewsOn),
    });
  }
  return next;
}

export interface PlanChangePaymentCheck {
  isPaid: boolean;
  subscription?: Subscription;
}

/**
 * Confere a cobranca da diferenca e, paga, liga o upgrade. Pagamento de outro
 * espaco ou de outra troca e recusado.
 */
export async function confirmPlanChangePayment(
  admin: SupabaseClient,
  organizationId: string,
  paymentId: string,
  options: { simulated?: boolean; author?: PlanAuthor } = {},
): Promise<PlanChangePaymentCheck> {
  // Sem pessoa: o aviso do parceiro de pagamentos ligou o plano.
  const author = options.author ?? systemAuthor("webhook.asaas");
  const subscription = await readOrganizationSubscription(admin, organizationId);
  const pending = subscription?.pendingChange;
  if (!subscription || !pending || pending.paymentId !== paymentId) {
    // Ja ligado pelo webhook (ou outra aba): pago se o Asaas confirma e e deste espaco.
    if (!subscription || paymentId.startsWith(MOCK_CHANGE_PREFIX) || !getAsaasConfig().masterApiKey) return { isPaid: false };
    const payment = await getPayment(paymentId);
    const reference = decodePlanChangeReference(payment.externalReference);
    const paid = reference?.organizationId === organizationId && PAID_STATUSES.includes(payment.status);
    return paid ? { isPaid: true, subscription } : { isPaid: false };
  }
  if (paymentId.startsWith(MOCK_CHANGE_PREFIX)) {
    if (!options.simulated) return { isPaid: false };
    assertCanSimulate();
    return { isPaid: true, subscription: await applyUpgrade(admin, organizationId, subscription, pending, author) };
  }
  const payment = await getPayment(paymentId);
  const reference = decodePlanChangeReference(payment.externalReference);
  if (!reference || reference.organizationId !== organizationId) {
    throw apiError("FORBIDDEN", "Pagamento de outro espaço.", { httpStatus: 403 });
  }
  if (!PAID_STATUSES.includes(payment.status)) return { isPaid: false };
  return { isPaid: true, subscription: await applyUpgrade(admin, organizationId, subscription, pending, author) };
}

/** Desmarca a troca marcada (antes do dia). */
export async function cancelScheduledPlanChange(
  admin: SupabaseClient,
  organizationId: string,
  author: PlanAuthor,
): Promise<Subscription> {
  const subscription = await readOrganizationSubscription(admin, organizationId);
  const scheduled = subscription?.scheduledChange;
  if (!subscription || !scheduled || subscription.tier === "free") {
    throw apiError("CONFLICT", "Não há troca de plano marcada.", { httpStatus: 409 });
  }
  // A volta ao Gratis da cortesia nao se desmarca: para continuar, assina o plano em Planos.
  if (subscription.courtesyUntil) {
    throw apiError("CONFLICT", "Esta é uma cortesia do GestaraHub e termina no dia combinado. Para continuar no plano, assine em Planos.", { httpStatus: 409 });
  }
  const current = { tier: subscription.tier, interval: subscription.interval ?? "monthly" } as const;
  let next: Subscription = { ...subscription, scheduledChange: undefined };
  if (onAsaas(subscription)) {
    if (scheduled.tier === "free") {
      // A assinatura foi encerrada no Asaas ao marcar: volta a mesma, com a
      // renovacao na data de sempre. Cartao vira fatura (Pix ou cartao).
      next = { ...next, ...(await recreateOnAsaas(organizationId, subscription, current)) };
    } else {
      await syncAsaasPlan(organizationId, subscription.asaasSubscriptionId, current);
    }
  }
  await writeOrganizationSubscription(admin, organizationId, next);
  await recordSubscriptionEvent(admin, organizationId, author, {
    kind: "change_canceled",
    before: subscription,
    after: next,
    effectiveOn: scheduled.effectiveOn,
    predicate: `desmarcou a troca do Plano GestaraHub para o ${planName({ tier: scheduled.tier, interval: scheduled.interval })} de ${ddmm(scheduled.effectiveOn)}`,
  });
  return next;
}

async function recreateOnAsaas(
  organizationId: string,
  subscription: Subscription,
  plan: { tier: PaidPlanTier; interval: SubscriptionInterval },
): Promise<Pick<Subscription, "asaasSubscriptionId" | "paymentMethod">> {
  if (!subscription.asaasCustomerId) {
    throw apiError("CONFLICT", "Assinatura sem cliente no parceiro de pagamentos.", { httpStatus: 409 });
  }
  const config = priceConfig(plan);
  const card = subscription.paymentMethod === "credit_card";
  const created = await createSubscription({
    customer: subscription.asaasCustomerId,
    billingType: card ? "UNDEFINED" : "PIX",
    value: config.value,
    nextDueDate: currentPlanOf(subscription).renewsOn ?? asaasToday(),
    cycle: cycleOf(plan.interval),
    description: config.description,
    externalReference: encodeSubscriptionReference(organizationId, plan.tier, plan.interval),
  });
  return { asaasSubscriptionId: created.id, paymentMethod: "pix" };
}

/** Chegou o dia da troca marcada. */
export async function applyScheduledPlanChange(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
  author: PlanAuthor = systemAuthor("cron.daily"),
): Promise<Subscription> {
  const scheduled = subscription.scheduledChange;
  if (!scheduled) return subscription;
  const next: Subscription =
    scheduled.tier === "free"
      ? { tier: "free", changedAt: new Date().toISOString() }
      : {
          ...subscription,
          tier: scheduled.tier,
          interval: scheduled.interval ?? subscription.interval,
          priceCents: planPriceCents(PLAN_PRICES, {
            tier: scheduled.tier,
            interval: scheduled.interval ?? subscription.interval ?? "monthly",
          }),
          scheduledChange: undefined,
          changedAt: new Date().toISOString(),
        };
  await writeOrganizationSubscription(admin, organizationId, next);
  const courtesy = Boolean(subscription.courtesyUntil);
  await recordSubscriptionEvent(admin, organizationId, author, {
    kind: courtesy ? "courtesy_ended" : "change_applied",
    before: subscription,
    after: next,
    effectiveOn: scheduled.effectiveOn,
    predicate: courtesy
      ? "encerrou a cortesia do Plano GestaraHub: o espaço voltou ao Grátis"
      : `aplicou a troca marcada: o Plano GestaraHub passou para o ${planName(next)}`,
  });
  return next;
}

/** Fim da tolerancia sem pagamento: volta ao Gratis e guarda o plano para religar. */
async function revertToFree(admin: SupabaseClient, organizationId: string, subscription: Subscription): Promise<Subscription> {
  const next: Subscription = {
    ...subscription,
    tier: "free",
    status: "past_due",
    revertedFrom: {
      tier: subscription.tier,
      interval: subscription.interval,
      on: currentPlanOf(subscription).renewsOn ?? dateInSpace(),
    },
    changedAt: new Date().toISOString(),
  };
  await writeOrganizationSubscription(admin, organizationId, next);
  await recordSubscriptionEvent(admin, organizationId, systemAuthor("cron.daily"), {
    kind: "reverted_to_free",
    before: subscription,
    after: next,
    effectiveOn: next.revertedFrom?.on,
    predicate: `voltou o espaço ao Grátis: a renovação de ${ddmm(next.revertedFrom?.on)} não foi paga em 5 dias`,
  });
  return next;
}

/**
 * 15 dias depois de voltar ao Gratis sem pagar: encerra a assinatura no Asaas
 * (para de gerar cobrancas) e guarda o plano que tinha, para o aviso. Dali em
 * diante, assina de novo pelo checkout quando quiser.
 */
async function closeAfterGrace(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
  today: string,
): Promise<Subscription> {
  const reverted = subscription.revertedFrom;
  if (!reverted) return subscription;
  if (onAsaas(subscription)) await cancelOnAsaas(subscription.asaasSubscriptionId);
  const next: Subscription = {
    tier: "free",
    asaasCustomerId: subscription.asaasCustomerId,
    closedFrom: { tier: reverted.tier, renewsOn: reverted.on, on: today },
    noticesSent: subscription.noticesSent,
    changedAt: new Date().toISOString(),
  };
  await writeOrganizationSubscription(admin, organizationId, next);
  await recordSubscriptionEvent(admin, organizationId, systemAuthor("cron.daily"), {
    kind: "closed",
    before: subscription,
    after: next,
    effectiveOn: reverted.on,
    predicate: `encerrou a assinatura do Plano ${planName({ tier: reverted.tier, interval: reverted.interval })}: 15 dias sem pagar a renovação de ${ddmm(reverted.on)}`,
  });
  return next;
}

async function organizationOfAsaasSubscription(
  admin: SupabaseClient,
  asaasSubscription: Pick<AsaasSubscriptionResponse, "id" | "externalReference">,
): Promise<string | undefined> {
  const reference = decodeSubscriptionReference(asaasSubscription.externalReference);
  if (reference) return reference.organizationId;
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("subscription->>asaasSubscriptionId", asaasSubscription.id)
    .maybeSingle();
  return data?.id ? String(data.id) : undefined;
}

/**
 * Pagamento da assinatura confirmado (webhook ou conferencia diaria): a
 * primeira cobranca liga o plano; as seguintes empurram a renovacao; paga
 * depois de voltar ao Gratis, religa o plano.
 */
export async function recordSubscriptionPaymentPaid(
  admin: SupabaseClient,
  payment: Pick<AsaasPaymentResponse, "id" | "dueDate" | "subscription" | "value">,
  knownOrganizationId?: string,
  author: PlanAuthor = systemAuthor("webhook.asaas"),
): Promise<{ organizationId: string; subscription: Subscription } | null> {
  if (!payment.subscription) return null;
  const asaasSubscription = await getSubscription(payment.subscription);
  const organizationId = knownOrganizationId ?? (await organizationOfAsaasSubscription(admin, asaasSubscription));
  if (!organizationId) return null;
  const subscription = await readOrganizationSubscription(admin, organizationId);

  // Assinatura que o espaco ainda nao tem (Pix pago com a tela fechada): liga pelo checkout.
  if (subscription?.asaasSubscriptionId !== asaasSubscription.id) {
    const check = await confirmSubscriptionPayment(admin, organizationId, payment.id, author);
    return check.subscription ? { organizationId, subscription: check.subscription } : null;
  }

  const interval = subscription.revertedFrom?.interval ?? subscription.interval ?? "monthly";
  const paidThrough = addPlanCycle(payment.dueDate, interval);
  const renewsOn = currentPlanOf(subscription).renewsOn;
  const advanced = !renewsOn || paidThrough > renewsOn;
  const next: Subscription = {
    ...subscription,
    ...(subscription.revertedFrom ? { tier: subscription.revertedFrom.tier, interval } : {}),
    status: "active",
    revertedFrom: undefined,
    ...(advanced ? { renewsOn: paidThrough, nextDueDate: paidThrough, noticesSent: [] } : {}),
    pendingPayment: subscription.pendingPayment?.id === payment.id ? undefined : subscription.pendingPayment,
  };
  await writeOrganizationSubscription(admin, organizationId, next);
  // Nota fiscal de cada renovacao paga (idempotente: o cartao avisa duas vezes).
  await queuePlanInvoice(admin, {
    organizationId,
    kind: "subscription",
    payment,
    serviceDescription: subscriptionInvoiceDescription(next, payment.dueDate),
  });
  if (subscription.revertedFrom || advanced) {
    await notifyPlanPaid(admin, organizationId, subscription.revertedFrom ? "reactivated" : "renewed", next);
    await recordSubscriptionEvent(admin, organizationId, author, {
      kind: subscription.revertedFrom ? "reactivated" : "renewed",
      before: subscription,
      after: next,
      paymentId: payment.id,
      effectiveOn: next.renewsOn,
      predicate: subscription.revertedFrom
        ? `religou o Plano ${planName(next)}: a renovação atrasada de ${ddmm(payment.dueDate)} foi paga`
        : `confirmou a renovação do Plano ${planName(next)}, paga até ${ddmm(next.renewsOn)}`,
    });
  }
  return { organizationId, subscription: next };
}

/** Cobranca da renovacao criada ou vencida: guarda para o aviso "pagar agora". */
export async function recordSubscriptionPaymentOpen(
  admin: SupabaseClient,
  payment: Pick<AsaasPaymentResponse, "id" | "dueDate" | "subscription" | "invoiceUrl">,
  overdue: boolean,
): Promise<boolean> {
  if (!payment.subscription) return false;
  const asaasSubscription = await getSubscription(payment.subscription);
  const organizationId = await organizationOfAsaasSubscription(admin, asaasSubscription);
  if (!organizationId) return false;
  const subscription = await readOrganizationSubscription(admin, organizationId);
  if (!subscription || subscription.asaasSubscriptionId !== asaasSubscription.id) return false;
  const next: Subscription = {
    ...subscription,
    pendingPayment: { id: payment.id, dueDate: payment.dueDate, ...(payment.invoiceUrl ? { invoiceUrl: payment.invoiceUrl } : {}) },
    ...(overdue && subscription.tier !== "free" ? { status: "past_due" } : {}),
  };
  await writeOrganizationSubscription(admin, organizationId, next);
  if (overdue && subscription.tier !== "free" && subscription.status !== "past_due") {
    await recordSubscriptionEvent(admin, organizationId, systemAuthor("webhook.asaas"), {
      kind: "renewal_overdue",
      before: subscription,
      after: next,
      paymentId: payment.id,
      effectiveOn: payment.dueDate,
      predicate: `avisou que a renovação do Plano ${planName(subscription)} de ${ddmm(payment.dueDate)} venceu sem pagamento`,
    });
  }
  return true;
}

/**
 * Pix Automatico da assinatura do plano (19/11/2026): o Asaas oferece a
 * autorizacao no Pix da assinatura; ativa, as renovacoes sao debitadas no
 * vencimento e os avisos deixam de pedir "pague ate o dia". Webhook e
 * conferencia diaria gravam aqui. Devolve se mudou algo.
 */
export async function recordPlanPixAutomatic(
  admin: SupabaseClient,
  authorization: Pick<AsaasPixAutomaticAuthorization, "id" | "status" | "subscriptionId">,
  knownOrganizationId?: string,
): Promise<boolean> {
  const subscriptionId = authorization.subscriptionId;
  if (!subscriptionId) return false;
  const organizationId =
    knownOrganizationId ?? (await organizationOfAsaasSubscription(admin, { id: subscriptionId, externalReference: undefined }));
  if (!organizationId) return false;
  const subscription = await readOrganizationSubscription(admin, organizationId);
  if (!subscription || subscription.asaasSubscriptionId !== subscriptionId) return false;
  const current = subscription.pixAutomatic;
  if (current?.authorizationId === authorization.id && current.status === authorization.status) return false;
  // Autorizacao antiga (ja trocada) nao volta por cima da nova.
  if (current && current.authorizationId !== authorization.id && current.status === "ACTIVE" && authorization.status !== "ACTIVE") {
    return false;
  }
  await writeOrganizationSubscription(admin, organizationId, {
    ...subscription,
    pixAutomatic: { authorizationId: authorization.id, status: authorization.status, updatedAt: new Date().toISOString() },
  });
  return true;
}

/** Conferencia diaria do Pix Automatico (o aviso do Asaas pode nao chegar). */
async function reconcilePlanPixAutomatic(admin: SupabaseClient, organizationId: string, subscription: Subscription): Promise<void> {
  if (!onAsaas(subscription) || subscription.paymentMethod === "credit_card" || subscription.tier === "free") return;
  try {
    const authorizations = await listSubscriptionPixAutomaticAuthorizations(subscription.asaasSubscriptionId);
    // A mais relevante: a ativa, se houver; senao a primeira da lista.
    const chosen = authorizations.find((a) => a.status === "ACTIVE") ?? authorizations[0];
    if (chosen) await recordPlanPixAutomatic(admin, { ...chosen, subscriptionId: subscription.asaasSubscriptionId }, organizationId);
  } catch (err) {
    logWarn("[subscriptionPlan] Pix Automático do plano não conferido:", err);
  }
}

/**
 * Pagamento do plano estornado (total ou parcial) ou contestado no cartao
 * (19/11/2026): o espaco volta ao Gratis na hora e a assinatura sai do Asaas.
 * Estorno e decisao do GestaraHub (regra: integral ate 7 dias do pagamento,
 * depois nenhum; doc product/13 §6). Devolve se mudou algo, ou null quando
 * o pagamento nao e do plano (cobranca de aluno numa subconta segue o fluxo dela).
 */
export async function recordPlanPaymentRefunded(
  admin: SupabaseClient,
  payment: Pick<AsaasPaymentResponse, "id" | "subscription" | "externalReference">,
  reason: "refund" | "chargeback",
): Promise<boolean | null> {
  const change = decodePlanChangeReference(payment.externalReference);
  let organizationId = change?.organizationId;
  if (!organizationId && payment.subscription) {
    try {
      organizationId = await organizationOfAsaasSubscription(admin, await getSubscription(payment.subscription));
    } catch (error) {
      // Assinatura ja removida no Asaas: procura pelo id guardado no espaco.
      if (!(error instanceof AsaasApiError && error.status === 404)) throw error;
      organizationId = await organizationOfAsaasSubscription(admin, { id: payment.subscription, externalReference: undefined });
    }
  }
  if (!organizationId) return null;
  const subscription = await readOrganizationSubscription(admin, organizationId);
  if (!subscription || subscription.tier === "free") return false;
  if (!change && subscription.asaasSubscriptionId !== payment.subscription) return false;

  if (onAsaas(subscription)) await cancelOnAsaas(subscription.asaasSubscriptionId);
  // Estornado: a nota e cancelada (outro mes: a equipe avisa a contabilidade).
  await cancelPlanInvoiceOfPayment(admin, organizationId, payment.id);
  const next: Subscription = { tier: "free", changedAt: new Date().toISOString() };
  await writeOrganizationSubscription(admin, organizationId, next);
  const what = reason === "chargeback" ? "contestado no cartão" : "estornado";
  await recordSubscriptionEvent(admin, organizationId, systemAuthor("webhook.asaas"), {
    kind: "canceled",
    before: subscription,
    after: next,
    paymentId: payment.id,
    predicate: `avisou que o pagamento do Plano ${planName(subscription)} foi ${what}: o espaço voltou ao Grátis`,
  });
  await notifyPlanManagers(admin, organizationId, {
    title: "Seu plano voltou ao Grátis",
    text: `O pagamento do Plano ${planName(subscription)} foi ${what}. Os dados continuam guardados; assine de novo quando quiser.`,
    action: "Ver os planos",
    actionUrl: `${planEmailAppUrl()}/plans`,
  }).catch((err) => logWarn("[subscriptionPlan] Aviso do estorno não enviado:", err));
  return true;
}

/** Assinatura encerrada direto no Asaas: o espaco volta ao Gratis. */
export async function recordSubscriptionRemoved(
  admin: SupabaseClient,
  asaasSubscription: Pick<AsaasSubscriptionResponse, "id" | "externalReference">,
): Promise<boolean> {
  const organizationId = await organizationOfAsaasSubscription(admin, asaasSubscription);
  if (!organizationId) return false;
  const subscription = await readOrganizationSubscription(admin, organizationId);
  if (!subscription || subscription.asaasSubscriptionId !== asaasSubscription.id) return false;
  // Gratis marcado por nos: o plano segue ate o fim do periodo pago.
  if (subscription.scheduledChange?.tier === "free") return false;
  const next: Subscription = { tier: "free", changedAt: new Date().toISOString() };
  await writeOrganizationSubscription(admin, organizationId, next);
  await recordSubscriptionEvent(admin, organizationId, systemAuthor("webhook.asaas"), {
    kind: "removed_at_partner",
    before: subscription,
    after: next,
    predicate: "avisou que a assinatura foi removida direto no parceiro: o espaço voltou ao Grátis",
  });
  return true;
}

/** Cobranca avulsa da diferenca paga (webhook). */
export async function recordPlanChangePaymentPaid(
  admin: SupabaseClient,
  payment: Pick<AsaasPaymentResponse, "id" | "externalReference">,
): Promise<boolean> {
  const reference = decodePlanChangeReference(payment.externalReference);
  if (!reference) return false;
  const check = await confirmPlanChangePayment(admin, reference.organizationId, payment.id);
  return check.isPaid;
}

/** Sem webhook (ou perdido): a renovacao paga no Asaas empurra a data mesmo assim. */
async function reconcileRenewal(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
  today: string,
): Promise<Subscription> {
  const renewsOn = currentPlanOf(subscription).renewsOn;
  if (!onAsaas(subscription) || !renewsOn || renewsOn > today) return subscription;
  const { data } = await getSubscriptionPayments(subscription.asaasSubscriptionId);
  const paid = (data ?? [])
    .filter((p) => !p.deleted && PAID_STATUSES.includes(p.status) && p.dueDate >= renewsOn)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
  if (!paid) return subscription;
  const result = await recordSubscriptionPaymentPaid(admin, paid, organizationId, systemAuthor("cron.daily"));
  return result?.subscription ?? subscription;
}

export interface PlanDailyResult {
  applied: number;
  reverted: number;
  closed: number;
  emails: number;
  /** Notas fiscais que falharam e foram pedidas de novo. */
  invoicesRetried: number;
  failures: number;
  /** Codigos do registro de erros das falhas. */
  errorReferences: string[];
}

/**
 * Rotina diaria do plano (doc product/13 §6): confere renovacoes pagas, aplica
 * as trocas marcadas, volta ao Gratis no fim da tolerancia e manda os avisos
 * por e-mail ao dono e ao gerente (uma vez por renovacao).
 */
export async function runPlanDailyTasks(
  admin: SupabaseClient,
  appUrl: string,
  options: { organizationIds?: string[] } = {},
): Promise<PlanDailyResult> {
  const result: PlanDailyResult = { applied: 0, reverted: 0, closed: 0, emails: 0, invoicesRetried: 0, failures: 0, errorReferences: [] };
  let query = admin.from("organizations").select("id, subscription, settings, units(address)").not("subscription", "is", null);
  // So alguns espacos (testes): a rotina nao mexe nos outros.
  if (options.organizationIds) query = query.in("id", options.organizationIds);
  const { data: orgs, error } = await query;
  if (error) throw error;
  // Plano pago, ou de volta ao Gratis por atraso (pagar depois religa).
  const withPlan = (orgs ?? []).filter((org) => {
    const subscription = org.subscription as Subscription | null;
    return subscription && (subscription.tier !== "free" || subscription.revertedFrom);
  });
  for (const org of withPlan) {
    // Um espaco com problema nao impede os outros; o dia seguinte tenta de novo.
    try {
      await runPlanDailyStep(admin, org, appUrl, result);
    } catch (err) {
      result.failures += 1;
      const organizationId = String(org.id);
      const reference = await reportError("cron.daily.plano", err, { source: "cron", organizationId });
      result.errorReferences.push(reference);
      await recordSystemAudit(admin, "cron.daily", {
        organizationId,
        action: "updated",
        target: { type: "subscription", label: "Plano GestaraHub" },
        predicate: `não conseguiu conferir o Plano GestaraHub (código ${reference})`,
        security: true,
        failed: true,
        errorReference: reference,
      });
    }
  }
  // Notas fiscais que falharam ao pedir (rotina de todos os espacos, nao a dos testes).
  if (!options.organizationIds) {
    try {
      result.invoicesRetried = await retryFailedPlanInvoices(admin);
    } catch (err) {
      result.errorReferences.push(await reportError("cron.daily.nota-fiscal", err, { source: "cron" }));
    }
  }
  return result;
}

async function runPlanDailyStep(
  admin: SupabaseClient,
  org: { id: unknown; subscription: unknown; settings: unknown; units: unknown },
  appUrl: string,
  result: PlanDailyResult,
): Promise<void> {
  const organizationId = String(org.id);
  const settings = org.settings as { timeZone?: string } | null;
  const units = (org.units ?? []) as { address?: { state?: string } | string | null }[];
  const today = dateInSpace(new Date(), resolveSpaceTimeZone(settings, units[0]?.address));
  await reconcilePlanPixAutomatic(admin, organizationId, org.subscription as Subscription);
  let subscription = await reconcileRenewal(
    admin,
    organizationId,
    (await readOrganizationSubscription(admin, organizationId)) ?? (org.subscription as Subscription),
    today,
  );
  const step = planDailyStep(subscription, today);
  if (step.applyScheduled) {
    await applyScheduledPlanChange(admin, organizationId, subscription);
    result.applied += 1;
    return;
  }
  if (step.revertToFree) {
    subscription = await revertToFree(admin, organizationId, subscription);
    result.reverted += 1;
  }
  if (step.closeSubscription) {
    subscription = await closeAfterGrace(admin, organizationId, subscription, today);
    result.closed += 1;
  }
  if (step.email) {
    const copy = planNoticeCopy(
      step.email,
      subscriptionTierLabel(subscription.revertedFrom?.tier ?? subscription.closedFrom?.tier ?? subscription.tier),
    );
    // Encerrada: o botao leva aos planos; antes disso, a cobranca em aberto.
    const actionUrl =
      step.email.kind === "closed"
        ? `${appUrl}/plans`
        : (subscription.pendingPayment?.invoiceUrl ?? `${appUrl}/settings?tab=plano`);
    const sent = await notifyPlanManagers(admin, organizationId, { ...copy, actionUrl });
    if (sent > 0) {
      result.emails += sent;
      await writeOrganizationSubscription(admin, organizationId, {
        ...subscription,
        noticesSent: [...(subscription.noticesSent ?? []), planNoticeKey(step.email)],
      });
    }
  }
}

