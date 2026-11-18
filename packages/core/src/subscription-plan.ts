import { addDays, addMonths, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { DateISO, Subscription, SubscriptionInterval, SubscriptionTier } from "@gestarahub/contracts";

/**
 * Regras do Plano GestaraHub (doc product/13 §6), puras: troca de plano,
 * renovacao e tolerancia de atraso. O servidor aplica (Asaas e banco); a tela
 * mostra a mesma conta antes de cobrar.
 *
 * - O que aumenta (plano maior, mensal → anual) vale na hora, com a diferenca
 *   proporcional aos dias que sobram; a data de renovacao nao muda, salvo no
 *   mensal → anual, que comeca o ciclo anual no dia.
 * - O que reduz (plano menor, anual → mensal, Gratis) vale no fim do periodo pago.
 * - Renovacao sem pagamento: 5 dias de tolerancia, com avisos; depois, Gratis.
 */

export type PaidPlanTier = Exclude<SubscriptionTier, "free">;

/** Precos em centavos, por plano e periodo. */
export type PlanPrices = Record<PaidPlanTier, Record<SubscriptionInterval, number>>;

export interface PlanChoice {
  tier: SubscriptionTier;
  interval: SubscriptionInterval;
}

export interface CurrentPlan extends PlanChoice {
  /** Fim do periodo pago (dia da renovacao). */
  renewsOn?: DateISO;
}

export type PlanChangeQuote =
  | { kind: "same" }
  /** Do Gratis para um plano pago: assinatura nova (checkout). */
  | { kind: "checkout" }
  | {
      kind: "now";
      chargeTodayCents: number;
      /** Dias que sobram do periodo atual e o tamanho dele. */
      remainingDays: number;
      periodDays: number;
      /** Renovacao depois da troca, e o valor dela. */
      renewsOn: DateISO;
      renewalCents: number;
      renewalInterval: SubscriptionInterval;
      /** Mensal → anual: o ciclo anual comeca hoje. */
      restartsCycle: boolean;
      /** Plano maior mas periodo menor (anual → mensal): o mensal entra na renovacao. */
      thenInterval?: SubscriptionInterval;
    }
  | {
      kind: "scheduled";
      effectiveOn: DateISO;
      /** Valor a partir da troca (0 no Gratis). */
      renewalCents: number;
    };

/** Grace period da renovacao nao paga, em dias. */
export const PLAN_GRACE_DAYS = 5;
/** Aviso antes da renovacao (so Pix: o cartao e cobrado sozinho). */
export const PLAN_RENEWAL_NOTICE_DAYS = 3;

const RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, scale: 2 };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Um periodo depois de `date` (mensal ou anual). */
export function addPlanCycle(date: DateISO, interval: SubscriptionInterval): DateISO {
  const d = parseISO(date);
  return iso(interval === "yearly" ? addYears(d, 1) : addMonths(d, 1));
}

function periodStartOf(renewsOn: DateISO, interval: SubscriptionInterval): DateISO {
  const d = parseISO(renewsOn);
  return iso(interval === "yearly" ? addYears(d, -1) : addMonths(d, -1));
}

export function planPriceCents(prices: PlanPrices, plan: PlanChoice): number {
  return plan.tier === "free" ? 0 : prices[plan.tier][plan.interval];
}

/** Dias que sobram do periodo pago e o tamanho do periodo. */
export function remainingPeriod(
  current: CurrentPlan,
  today: DateISO,
): { remainingDays: number; periodDays: number } {
  if (!current.renewsOn) return { remainingDays: 0, periodDays: 1 };
  const start = periodStartOf(current.renewsOn, current.interval);
  const periodDays = Math.max(1, differenceInCalendarDays(parseISO(current.renewsOn), parseISO(start)));
  const remaining = differenceInCalendarDays(parseISO(current.renewsOn), parseISO(today));
  return { remainingDays: Math.min(periodDays, Math.max(0, remaining)), periodDays };
}

/**
 * Quanto custa trocar de `current` para `target` hoje, e quando vale.
 * Exemplo da doc: Pro mensal (7990) → Scale mensal (19900) com 20 de 30 dias
 * sobrando = (19900 − 7990) × 20/30 = 7940 hoje; renovacao igual, 19900.
 */
export function quotePlanChange(
  current: CurrentPlan,
  target: PlanChoice,
  today: DateISO,
  prices: PlanPrices,
): PlanChangeQuote {
  if (current.tier === target.tier && (current.tier === "free" || current.interval === target.interval)) {
    return { kind: "same" };
  }
  if (current.tier === "free") return { kind: "checkout" };

  const renewsOn = current.renewsOn ?? today;
  const tierUp = RANK[target.tier] > RANK[current.tier];
  const sameTier = target.tier === current.tier;
  const monthlyToYearly = current.interval === "monthly" && target.interval === "yearly";
  const { remainingDays, periodDays } = remainingPeriod(current, today);
  const fraction = remainingDays / periodDays;
  const currentPrice = planPriceCents(prices, current);

  // Mensal → anual (mesmo plano ou maior): na hora, o ciclo anual comeca hoje
  // e os dias que sobram do mes abatem o anual.
  if (target.tier !== "free" && monthlyToYearly && (tierUp || sameTier)) {
    const yearly = planPriceCents(prices, target);
    return {
      kind: "now",
      chargeTodayCents: Math.max(0, yearly - Math.round(currentPrice * fraction)),
      remainingDays,
      periodDays,
      renewsOn: addPlanCycle(today, "yearly"),
      renewalCents: yearly,
      renewalInterval: "yearly",
      restartsCycle: true,
    };
  }

  // Plano maior: na hora, diferenca proporcional no periodo atual; a renovacao
  // nao muda. Se o periodo pedido e menor (anual → mensal), ele entra na renovacao.
  if (tierUp && target.tier !== "free") {
    const sameInterval = { tier: target.tier, interval: current.interval };
    const upgraded = planPriceCents(prices, sameInterval);
    const thenInterval = target.interval !== current.interval ? target.interval : undefined;
    return {
      kind: "now",
      chargeTodayCents: Math.max(0, Math.round((upgraded - currentPrice) * fraction)),
      remainingDays,
      periodDays,
      renewsOn,
      renewalCents: planPriceCents(prices, target),
      renewalInterval: target.interval,
      restartsCycle: false,
      ...(thenInterval ? { thenInterval } : {}),
    };
  }

  // Reduz (plano menor, anual → mensal, Gratis): no fim do periodo pago.
  return { kind: "scheduled", effectiveOn: renewsOn, renewalCents: planPriceCents(prices, target) };
}

/** Dias, depois de voltar ao Gratis, ate encerrar a assinatura no Asaas. */
export const PLAN_CLOSE_AFTER_REVERT_DAYS = 15;
/** Dias que o aviso "assinatura encerrada" fica no app. */
const CLOSED_NOTICE_DAYS = 7;

export type PlanNoticeKind =
  | "renews_soon"
  | "payment_pending"
  | "grace_ending"
  /** Voltou ao Gratis: ha 15 dias para pagar e religar. */
  | "reverted"
  /** Lembrete no meio dos 15 dias. */
  | "revert_reminder"
  /** Faltam 2 dias ou menos para encerrar a assinatura. */
  | "closing_soon"
  /** Assinatura encerrada; da para assinar de novo quando quiser. */
  | "closed";

export interface PlanNotice {
  kind: PlanNoticeKind;
  /** Dia da renovacao a que o aviso se refere. */
  renewsOn: DateISO;
  /** Dias ate voltar ao Gratis (`grace_ending`) ou ate encerrar a assinatura (depois de voltar). */
  daysLeft?: number;
  /** Dia em que a assinatura e encerrada no Asaas (depois de voltar ao Gratis). */
  closesOn?: DateISO;
}

/** Ultimo dia com o plano funcionando sem o pagamento da renovacao. */
export function graceEndsOn(renewsOn: DateISO): DateISO {
  return iso(addDays(parseISO(renewsOn), PLAN_GRACE_DAYS));
}

/** Dia em que a assinatura e encerrada, se a renovacao `renewsOn` nao for paga. */
export function subscriptionClosesOn(renewsOn: DateISO): DateISO {
  return iso(addDays(parseISO(graceEndsOn(renewsOn)), PLAN_CLOSE_AFTER_REVERT_DAYS));
}

/**
 * Depois de voltar ao Gratis: 15 dias para pagar a renovacao e religar, com
 * aviso no dia, lembrete no 7º dia e "faltam 2 dias" no fim.
 */
function afterRevertNotice(renewsOn: DateISO, today: DateISO): PlanNotice {
  const closesOn = subscriptionClosesOn(renewsOn);
  const daysLeft = Math.max(0, differenceInCalendarDays(parseISO(closesOn), parseISO(today)));
  const since = PLAN_CLOSE_AFTER_REVERT_DAYS - daysLeft;
  const kind: PlanNoticeKind = daysLeft <= 2 ? "closing_soon" : since >= 7 ? "revert_reminder" : "reverted";
  return { kind, renewsOn, daysLeft, closesOn };
}

/**
 * Aviso do plano para hoje (aviso fixo no topo e e-mail), ou nenhum:
 * 3 dias antes da renovacao (so Pix), no vencimento sem pagamento, 3 dias
 * depois ("faltam 2 dias") e, do 5º dia em diante, de volta ao Gratis, com 15
 * dias para pagar antes de encerrar a assinatura. O cartao e cobrado no
 * vencimento: o aviso de pendente so sai no dia seguinte.
 */
export function planNoticeFor(subscription: Subscription | undefined, today: DateISO): PlanNotice | null {
  if (!subscription) return null;
  if (subscription.tier === "free") {
    if (subscription.revertedFrom) return afterRevertNotice(subscription.revertedFrom.on, today);
    const closed = subscription.closedFrom;
    if (closed && differenceInCalendarDays(parseISO(today), parseISO(closed.on)) < CLOSED_NOTICE_DAYS) {
      return { kind: "closed", renewsOn: closed.renewsOn };
    }
    return null;
  }
  const renewsOn = subscription.renewsOn;
  // Gratis marcado: nao renova, nao ha o que cobrar.
  if (!renewsOn || subscription.scheduledChange?.tier === "free") return null;
  const late = differenceInCalendarDays(parseISO(today), parseISO(renewsOn));
  const card = subscription.paymentMethod === "credit_card";
  if (late < 0) {
    return !card && -late <= PLAN_RENEWAL_NOTICE_DAYS ? { kind: "renews_soon", renewsOn } : null;
  }
  if (late >= PLAN_GRACE_DAYS) return afterRevertNotice(renewsOn, today);
  if (late >= 3) return { kind: "grace_ending", renewsOn, daysLeft: PLAN_GRACE_DAYS - late };
  if (card && late === 0) return null;
  return { kind: "payment_pending", renewsOn };
}

export interface PlanDailyStep {
  /** Aplicar a troca marcada (chegou o dia). */
  applyScheduled: boolean;
  /** Voltar ao Gratis (fim da tolerancia sem pagamento). */
  revertToFree: boolean;
  /** Encerrar a assinatura no Asaas (15 dias depois de voltar ao Gratis). */
  closeSubscription: boolean;
  /** Aviso a mandar por e-mail hoje, uma vez por renovacao. */
  email: PlanNotice | null;
}

/** O que a rotina diaria faz com a assinatura hoje. */
export function planDailyStep(subscription: Subscription | undefined, today: DateISO): PlanDailyStep {
  const none: PlanDailyStep = { applyScheduled: false, revertToFree: false, closeSubscription: false, email: null };
  if (!subscription) return none;
  const unsent = (notice: PlanNotice | null) =>
    notice && !(subscription.noticesSent ?? []).includes(planNoticeKey(notice)) ? notice : null;

  if (subscription.tier === "free") {
    const reverted = subscription.revertedFrom;
    if (!reverted) return none;
    if (today >= subscriptionClosesOn(reverted.on)) {
      return { ...none, closeSubscription: true, email: unsent({ kind: "closed", renewsOn: reverted.on }) };
    }
    return { ...none, email: unsent(planNoticeFor(subscription, today)) };
  }

  const scheduled = subscription.scheduledChange;
  if (scheduled && scheduled.effectiveOn <= today) return { ...none, applyScheduled: true };
  const notice = planNoticeFor(subscription, today);
  const afterRevert = notice?.kind === "reverted" || notice?.kind === "revert_reminder" || notice?.kind === "closing_soon";
  return { ...none, revertToFree: afterRevert, email: unsent(notice) };
}

/** Chave do aviso ja mandado ("<renovacao>:<tipo>"). */
export function planNoticeKey(notice: PlanNotice): string {
  return `${notice.renewsOn}:${notice.kind}`;
}
