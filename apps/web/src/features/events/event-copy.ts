import type { EventBillingMode, EventSession, EventStage, EventView } from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";

/** Textos curtos do evento, usados na lista, no detalhe e no dia. */

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "sáb 15/11". */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return `${WEEKDAY_SHORT[weekday]} ${brDate(iso)}`;
}

/** "15/11", "15/11 e 16/11" ou "15/11 a 17/11 (3 dias)". */
export function datesLabel(event: Pick<EventView, "firstDate" | "lastDate" | "sessions">): string {
  const days = [...new Set(event.sessions.filter((s) => s.status !== "canceled").map((s) => s.date))].sort();
  if (days.length === 0) return "Sem dias";
  if (days.length === 1) return brDate(days[0]);
  if (days.length === 2) return `${brDate(days[0])} e ${brDate(days[1])}`;
  return `${brDate(days[0])} a ${brDate(days[days.length - 1])} (${days.length} dias)`;
}

export function hoursLabel(hours: number): string {
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
  return `${text}h`;
}

export const STAGE_LABEL: Record<EventStage, string> = {
  upcoming: "Em breve",
  ongoing: "Em andamento",
  finished: "Encerrado",
};

export const BILLING_MODE_LABEL: Record<EventBillingMode, string> = {
  fixed: "Valor fechado",
  per_day: "Por dia",
  free: "Sem cobrança",
};

/** "R$ 300,00 em até 3x", "R$ 250,00 no lote até 30/09", "R$ 80,00 por dia" ou "Sem cobrança". */
export function billingSummary(event: EventView): string {
  if (event.billingMode === "free") return "Sem cobrança";
  if (event.billingMode === "per_day") return `${formatCents(event.dayPriceCents ?? 0)} por dia`;
  const base = `${formatCents(event.priceCents ?? 0)}${(event.maxInstallments ?? 1) > 1 ? ` em até ${event.maxInstallments}x` : ""}`;
  if (event.earlyBirdActive && event.earlyBirdPriceCents && event.earlyBirdUntil) {
    return `${formatCents(event.earlyBirdPriceCents)} no lote até ${brDate(event.earlyBirdUntil)} · depois ${base}`;
  }
  return base;
}

/** "3 inscritos", "3 de 20 vagas" ou "Lotado (20)". */
export function occupancyLabel(event: Pick<EventView, "confirmedCount" | "capacity" | "isFull">): string {
  if (event.capacity === undefined) return plural(event.confirmedCount, "inscrito", "inscritos");
  if (event.isFull) return `Lotado (${event.capacity})`;
  return `${event.confirmedCount} de ${event.capacity} vagas`;
}

export function sessionTimeLabel(session: Pick<EventSession, "start" | "end">): string {
  return `${session.start} às ${session.end}`;
}
