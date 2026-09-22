import { addDays, addMonths, format, parseISO } from "date-fns";
import type {
  DateISO,
  PlanPeriod,
  StudentBillingStrategy,
  StudentCyclePaymentTiming,
  StudentDiscount,
} from "@gestarahub/contracts";

/**
 * Motor de cobranca de mensalidades (puro, sem store). Fonte unica da regra:
 * o cadastro do aluno (1a cobranca), a geracao em lote e a previa das
 * Configuracoes chamam estas funcoes, para nunca divergirem.
 *
 * Modelo: o plano e dividido em periodos de uso consecutivos a partir da data
 * de entrada. Cada periodo vira uma cobranca; "antecipado" vence no inicio do
 * periodo e "depois do uso" vence no vencimento seguinte ao fim dele. A
 * competencia de uma cobranca e o mes do seu vencimento.
 *
 * - Mensal proporcional: 1o periodo vai da entrada ao fim do mes (valor
 *   proporcional aos dias); depois, meses de calendario. Vencimento no dia
 *   padrao (dueDay).
 * - Mensal mes cheio: ciclos mensais ancorados no dia de vencimento do aluno
 *   (por padrao, o dia da entrada).
 * - Quinzenal proporcional: quinzenas de calendario (1-15 e 16-fim); o 1o
 *   periodo e proporcional aos dias restantes da quinzena.
 * - Quinzenal mes cheio: ciclos de 15 dias a partir da entrada.
 * - Semanal: ciclos de 7 dias a partir da entrada (semanas reais: 4 ou 5 por
 *   mes; nao ha proporcional).
 */

export type BillingTiming = StudentCyclePaymentTiming;
export type BillingStrategy = StudentBillingStrategy;

export interface MembershipTerms {
  period: PlanPeriod;
  /** Valor cheio de um periodo, ja com desconto aplicado. */
  priceCents: number;
  startDate: DateISO;
  timing: BillingTiming;
  strategy: BillingStrategy;
  /** Dia de vencimento recorrente (1 a 31; dia inexistente cai no ultimo dia do mes). */
  dueDay: number;
}

export interface ScheduledCharge {
  periodStart: DateISO;
  periodEnd: DateISO;
  dueDate: DateISO;
  /** "YYYY-MM" do vencimento. */
  competence: string;
  amountCents: number;
  isProrated: boolean;
  /** Dias cobrados quando proporcional. */
  proratedDays?: number;
}

export interface CompetenceCharge extends ScheduledCharge {
  /** Posicao da cobranca dentro da competencia (1-based). */
  cycleIndex: number;
  cycleTotal: number;
}

const MAX_PERIODS = 600;

const toISO = (date: Date): DateISO => format(date, "yyyy-MM-dd");

function lastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Data no mes de `base` com o dia limitado ao ultimo dia daquele mes. */
export function dayInMonth(base: Date, day: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(day, 1), lastDayOfMonth(base)));
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Aplica o desconto do aluno (fixo em centavos ou percentual), nunca abaixo de zero. */
export function applyDiscount(priceCents: number, discount?: StudentDiscount): number {
  if (!discount || discount.value <= 0) return priceCents;
  const off =
    discount.type === "percentage"
      ? Math.round((priceCents * Math.min(discount.value, 100)) / 100)
      : Math.round(discount.value);
  return Math.max(0, priceCents - off);
}

function prorate(priceCents: number, usedDays: number, periodDays: number): number {
  return Math.round((priceCents / periodDays) * usedDays);
}

export interface MembershipTermsInput {
  period?: PlanPeriod;
  planPriceCents: number;
  startDate: DateISO;
  strategy?: BillingStrategy;
  timing?: BillingTiming;
  dueDay?: number;
  discount?: StudentDiscount;
}

export interface BillingDefaults {
  billingTiming?: BillingTiming;
  midMonthStrategy?: BillingStrategy;
  defaultDueDay?: number;
}

/**
 * Termos efetivos: a regra propria do aluno prevalece; o que faltar vem da
 * academia. No mes cheio, o vencimento padrao e o dia da entrada.
 */
export function resolveMembershipTerms(
  input: MembershipTermsInput,
  defaults: BillingDefaults = {},
): MembershipTerms {
  const strategy = input.strategy ?? defaults.midMonthStrategy ?? "prorated";
  const startDay = Number(input.startDate.slice(8, 10));
  return {
    period: input.period ?? "monthly",
    priceCents: applyDiscount(input.planPriceCents, input.discount),
    startDate: input.startDate,
    timing: input.timing ?? defaults.billingTiming ?? "prepaid",
    strategy,
    dueDay: input.dueDay ?? (strategy === "full_cycle" ? startDay : defaults.defaultDueDay ?? 10),
  };
}

interface RawPeriod {
  start: Date;
  end: Date;
  amountCents: number;
  isProrated: boolean;
  proratedDays?: number;
  /** Vencimento no modo antecipado. */
  prepaidDue: Date;
  /** Vencimento no modo depois do uso. */
  postpaidDue: Date;
}

function* monthlyProrated(t: MembershipTerms, start: Date): Generator<RawPeriod> {
  const dim = lastDayOfMonth(start);
  const used = dim - start.getDate() + 1;
  const partial = start.getDate() > 1;
  yield {
    start,
    end: new Date(start.getFullYear(), start.getMonth(), dim),
    amountCents: partial ? prorate(t.priceCents, used, dim) : t.priceCents,
    isProrated: partial,
    proratedDays: partial ? used : undefined,
    prepaidDue: start,
    postpaidDue: dayInMonth(addMonths(firstOfMonth(start), 1), t.dueDay),
  };
  for (let k = 1; ; k++) {
    const month = addMonths(firstOfMonth(start), k);
    yield {
      start: month,
      end: new Date(month.getFullYear(), month.getMonth(), lastDayOfMonth(month)),
      amountCents: t.priceCents,
      isProrated: false,
      prepaidDue: dayInMonth(month, t.dueDay),
      postpaidDue: dayInMonth(addMonths(month, 1), t.dueDay),
    };
  }
}

function* monthlyFullCycle(t: MembershipTerms, start: Date): Generator<RawPeriod> {
  const cycleStart = (k: number): Date =>
    k === 0 ? start : dayInMonth(addMonths(firstOfMonth(start), k), t.dueDay);
  for (let k = 0; ; k++) {
    const s = cycleStart(k);
    const next = cycleStart(k + 1);
    yield {
      start: s,
      end: addDays(next, -1),
      amountCents: t.priceCents,
      isProrated: false,
      prepaidDue: s,
      postpaidDue: next,
    };
  }
}

function* biweeklyProrated(t: MembershipTerms, start: Date): Generator<RawPeriod> {
  const base = Math.min(Math.max(t.dueDay, 1), 15);
  const halfDue = (date: Date, half: 1 | 2): Date => dayInMonth(date, half === 1 ? base : base + 15);
  const halfOf = (date: Date): { half: 1 | 2; start: Date; end: Date } => {
    const last = lastDayOfMonth(date);
    return date.getDate() <= 15
      ? { half: 1, start: dayInMonth(date, 1), end: dayInMonth(date, 15) }
      : { half: 2, start: dayInMonth(date, 16), end: dayInMonth(date, last) };
  };
  const dues = (h: { half: 1 | 2; start: Date }) => ({
    prepaidDue: halfDue(h.start, h.half),
    postpaidDue: h.half === 1 ? halfDue(h.start, 2) : halfDue(addMonths(firstOfMonth(h.start), 1), 1),
  });

  const first = halfOf(start);
  const halfDays = first.end.getDate() - first.start.getDate() + 1;
  const used = first.end.getDate() - start.getDate() + 1;
  const partial = used < halfDays;
  yield {
    start,
    end: first.end,
    amountCents: partial ? prorate(t.priceCents, used, halfDays) : t.priceCents,
    isProrated: partial,
    proratedDays: partial ? used : undefined,
    ...dues(first),
    prepaidDue: start,
  };
  let cursor = addDays(first.end, 1);
  for (;;) {
    const h = halfOf(cursor);
    yield { start: h.start, end: h.end, amountCents: t.priceCents, isProrated: false, ...dues(h) };
    cursor = addDays(h.end, 1);
  }
}

function* fixedDayCycles(t: MembershipTerms, start: Date, days: number): Generator<RawPeriod> {
  for (let k = 0; ; k++) {
    const s = addDays(start, k * days);
    const next = addDays(start, (k + 1) * days);
    yield {
      start: s,
      end: addDays(next, -1),
      amountCents: t.priceCents,
      isProrated: false,
      prepaidDue: s,
      postpaidDue: next,
    };
  }
}

function periodsFor(t: MembershipTerms): Generator<RawPeriod> {
  const start = parseISO(t.startDate);
  if (t.period === "weekly") return fixedDayCycles(t, start, 7);
  if (t.period === "biweekly") {
    return t.strategy === "full_cycle" ? fixedDayCycles(t, start, 15) : biweeklyProrated(t, start);
  }
  return t.strategy === "full_cycle" ? monthlyFullCycle(t, start) : monthlyProrated(t, start);
}

function toScheduled(t: MembershipTerms, p: RawPeriod): ScheduledCharge {
  const due = toISO(t.timing === "postpaid" ? p.postpaidDue : p.prepaidDue);
  return {
    periodStart: toISO(p.start),
    periodEnd: toISO(p.end),
    dueDate: due,
    competence: due.slice(0, 7),
    amountCents: p.amountCents,
    isProrated: p.isProrated,
    proratedDays: p.proratedDays,
  };
}

/** Primeira cobranca do aluno (a gerada no cadastro/matricula no plano). */
export function firstCharge(terms: MembershipTerms): ScheduledCharge {
  return toScheduled(terms, periodsFor(terms).next().value as RawPeriod);
}

/** As `count` primeiras cobrancas, em ordem de periodo. */
export function upcomingCharges(terms: MembershipTerms, count: number): ScheduledCharge[] {
  const out: ScheduledCharge[] = [];
  for (const p of periodsFor(terms)) {
    if (out.length >= count) break;
    out.push(toScheduled(terms, p));
  }
  return out;
}

/**
 * Cobrancas que vencem na competencia ("YYYY-MM"). Os vencimentos crescem
 * junto com os periodos, entao a varredura para no primeiro alem da competencia.
 */
export function chargesDueIn(terms: MembershipTerms, competence: string): CompetenceCharge[] {
  const found: ScheduledCharge[] = [];
  let i = 0;
  for (const p of periodsFor(terms)) {
    if (++i > MAX_PERIODS) break;
    const c = toScheduled(terms, p);
    if (c.competence > competence) break;
    if (c.competence === competence) found.push(c);
  }
  return found.map((c, idx) => ({ ...c, cycleIndex: idx + 1, cycleTotal: found.length }));
}
