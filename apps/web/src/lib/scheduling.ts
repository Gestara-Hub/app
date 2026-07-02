import { addDays, addMonths, addWeeks, getDay, parseISO } from "date-fns";
import type {
  BusinessHoursDay,
  DateISO,
  Frequency,
  TimeISO,
  Weekday,
  WorkingHours,
} from "@/types";

/**
 * Nucleo de agenda (puro, sem store): aritmetica de horario, conflito de slot
 * (expediente + bloqueio + sobreposicao) e geracao de datas de recorrencia.
 * Os services montam o contexto a partir do store e chamam estas funcoes.
 */

// --- Aritmetica de horario 'HH:mm' -----------------------------------------

export function timeToMinutes(time: TimeISO): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): TimeISO {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutesToTime(time: TimeISO, minutes: number): TimeISO {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** Intervalos [aStart, aEnd) e [bStart, bEnd) se sobrepoem? (meio-aberto) */
export function rangesOverlap(
  aStart: TimeISO,
  aEnd: TimeISO,
  bStart: TimeISO,
  bEnd: TimeISO,
): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function weekdayOf(date: DateISO): Weekday {
  return getDay(parseISO(date)) as Weekday;
}

// --- Disponibilidade de slot -----------------------------------------------

export type SlotConflictCode =
  | "OUTSIDE_BUSINESS_HOURS"
  | "ON_BREAK"
  | "TIME_BLOCKED"
  | "OVERLAP_CONFLICT";

interface Interval {
  start: TimeISO;
  end: TimeISO;
}

export interface SlotContext {
  /** Funcionamento da unidade (por dia da semana). */
  businessHours: BusinessHoursDay[];
  /** Horarios de trabalho do profissional (por dia da semana). */
  workingHours: WorkingHours[];
  /** Bloqueios do profissional na data. */
  blocks: Interval[];
  /** Agendamentos que ocupam a agenda do profissional na data (exclui o proprio
   *  e os cancelados/no-show). */
  appointments: Interval[];
}

export type SlotCheck =
  | { ok: true }
  | { ok: false; code: SlotConflictCode };

/**
 * Verifica se [start, end) e um slot valido para o profissional na data:
 * dentro do expediente (unidade ∩ profissional), sem bloqueio e sem
 * sobreposicao. Retorna o primeiro conflito encontrado.
 */
export function checkSlotAvailability(
  date: DateISO,
  start: TimeISO,
  end: TimeISO,
  ctx: SlotContext,
  // `allowBreak` pula APENAS a checagem de almoco (override com confirmacao do
  // usuario); bloqueio, sobreposicao e expediente continuam valendo.
  opts: { allowBreak?: boolean } = {},
): SlotCheck {
  const weekday = weekdayOf(date);

  const business = ctx.businessHours.find((b) => b.weekday === weekday);
  const working = ctx.workingHours.find((w) => w.weekday === weekday);
  if (!business || business.closed || !business.start || !business.end || !working) {
    return { ok: false, code: "OUTSIDE_BUSINESS_HOURS" };
  }

  const effectiveStart = Math.max(
    timeToMinutes(business.start),
    timeToMinutes(working.start),
  );
  const effectiveEnd = Math.min(
    timeToMinutes(business.end),
    timeToMinutes(working.end),
  );
  if (timeToMinutes(start) < effectiveStart || timeToMinutes(end) > effectiveEnd) {
    return { ok: false, code: "OUTSIDE_BUSINESS_HOURS" };
  }

  // Intervalo (almoco) do profissional: recusa slot que o cobre, salvo override.
  if (
    !opts.allowBreak &&
    working.breakStart &&
    working.breakEnd &&
    rangesOverlap(start, end, working.breakStart, working.breakEnd)
  ) {
    return { ok: false, code: "ON_BREAK" };
  }

  if (ctx.blocks.some((b) => rangesOverlap(start, end, b.start, b.end))) {
    return { ok: false, code: "TIME_BLOCKED" };
  }

  if (ctx.appointments.some((a) => rangesOverlap(start, end, a.start, a.end))) {
    return { ok: false, code: "OVERLAP_CONFLICT" };
  }

  return { ok: true };
}

// --- Recorrencia (geracao de datas) ----------------------------------------

export interface RecurrenceEnd {
  untilOccurrences?: number;
  untilDate?: DateISO;
}

// Trava de seguranca para "ate uma data" (serie sempre finita no MVP).
const MAX_OCCURRENCES = 200;

function occurrenceDate(frequency: Frequency, start: Date, index: number): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(start, index);
    case "biweekly":
      return addDays(start, index * 14);
    case "monthly":
      return addMonths(start, index);
  }
}

/**
 * Datas das ocorrencias de uma serie, a partir de `startDate`, pela `frequency`,
 * terminando por numero de ocorrencias OU por data final (inclusive).
 */
export function generateOccurrenceDates(
  frequency: Frequency,
  startDate: DateISO,
  end: RecurrenceEnd,
): DateISO[] {
  const base = parseISO(startDate);
  const dates: DateISO[] = [];

  if (end.untilOccurrences && end.untilOccurrences > 0) {
    const total = Math.min(end.untilOccurrences, MAX_OCCURRENCES);
    for (let i = 0; i < total; i++) {
      dates.push(formatDate(occurrenceDate(frequency, base, i)));
    }
    return dates;
  }

  if (end.untilDate) {
    const limit = parseISO(end.untilDate);
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const d = occurrenceDate(frequency, base, i);
      if (d.getTime() > limit.getTime()) break;
      dates.push(formatDate(d));
    }
  }

  return dates;
}

function formatDate(d: Date): DateISO {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
