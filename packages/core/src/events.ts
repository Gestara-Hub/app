import type { DateISO, EventBillingMode, EventRegistrationScope, EventStage, TimeISO } from "@gestarahub/contracts";

/**
 * Regras puras de eventos e seminarios (doc product/29). Nada aqui le o
 * espaco: recebe os dias e o evento e devolve situacao, horas e preco.
 */

export interface EventDayLike {
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  status?: "scheduled" | "done" | "canceled";
}

export interface EventPricingLike {
  billingMode: EventBillingMode;
  priceCents?: number;
  dayPriceCents?: number;
  earlyBirdPriceCents?: number;
  earlyBirdUntil?: DateISO;
}

/** Dias que contam (nao cancelados), do primeiro ao ultimo. */
export function activeDays<T extends EventDayLike>(days: readonly T[]): T[] {
  return days.filter((d) => d.status !== "canceled").sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

/** Posicao do dia entre os dias valendo do evento ("dia 3 de 3"); dia cancelado ou de fora: null. */
export function dayPosition<T extends EventDayLike & { id: string }>(
  days: readonly T[],
  dayId: string,
): { position: number; total: number } | null {
  const active = activeDays(days);
  const index = active.findIndex((d) => d.id === dayId);
  return index < 0 ? null : { position: index + 1, total: active.length };
}

/** Antes do primeiro dia, entre o primeiro e o ultimo, ou depois do ultimo. Sem dias: `upcoming`. */
export function eventStage(days: readonly EventDayLike[], today: DateISO): EventStage {
  const active = activeDays(days);
  if (active.length === 0) return "upcoming";
  const first = active[0].date;
  const last = active[active.length - 1].date;
  if (today < first) return "upcoming";
  if (today > last) return "finished";
  return "ongoing";
}

function minutesOf(time: TimeISO): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Horas somadas dos dias nao cancelados, com uma casa decimal (3h30 = 3.5). */
export function eventTotalHours(days: readonly EventDayLike[]): number {
  const minutes = activeDays(days).reduce((sum, d) => sum + Math.max(0, minutesOf(d.end) - minutesOf(d.start)), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

/** O lote vale em `date`: tem preco e data e ainda nao passou. */
export function earlyBirdActive(event: EventPricingLike, date: DateISO): boolean {
  return (
    event.billingMode === "fixed" &&
    typeof event.earlyBirdPriceCents === "number" &&
    event.earlyBirdPriceCents > 0 &&
    Boolean(event.earlyBirdUntil) &&
    date <= (event.earlyBirdUntil as string)
  );
}

/**
 * Valor sugerido da inscricao em `date`: lote se valer, senao o cheio;
 * por dia, a soma dos dias escolhidos (ou de todos, na inscricao completa);
 * sem cobranca, zero. O valor final e editavel na inscricao.
 */
export function suggestedRegistrationPrice(
  event: EventPricingLike,
  scope: EventRegistrationScope,
  dayCount: number,
  date: DateISO,
): number {
  if (event.billingMode === "free") return 0;
  if (event.billingMode === "per_day") return (event.dayPriceCents ?? 0) * Math.max(0, dayCount);
  if (scope === "days") return (event.dayPriceCents ?? event.priceCents ?? 0) * Math.max(0, dayCount);
  return earlyBirdActive(event, date) ? (event.earlyBirdPriceCents as number) : (event.priceCents ?? 0);
}

/** Dois blocos do mesmo dia se cruzam (qualquer minuto em comum). */
export function daysOverlap(a: EventDayLike, b: EventDayLike): boolean {
  return a.date === b.date && a.start < b.end && b.start < a.end;
}
