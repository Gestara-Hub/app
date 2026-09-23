import { addDays, addMonths, addWeeks, getDay, parseISO } from "date-fns";
import type {
  BusinessHoursDay,
  BusinessHoursShift,
  ClassGroup,
  ClassMeetingSlot,
  DateISO,
  Frequency,
  TimeISO,
  Weekday,
  WorkingHours,
} from "@gestarahub/contracts";

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

export const WEEKDAY_LABELS_PT: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const WEEKDAY_PLURAL_PT: Record<Weekday, string> = {
  0: "domingos",
  1: "segundas-feiras",
  2: "terças-feiras",
  3: "quartas-feiras",
  4: "quintas-feiras",
  5: "sextas-feiras",
  6: "sábados",
};

export interface SlotBusinessHoursCheck {
  valid: boolean;
  reason?: "CLOSED" | "OUTSIDE_SHIFTS" | "NO_SHIFTS";
  message?: string;
}

/**
 * Verifica se um slot recorrente ou aula [start, end] está totalmente
 * contido em um dos turnos de funcionamento da unidade no dia da semana.
 */
export function checkSlotWithinBusinessHours(
  weekday: Weekday,
  start: TimeISO,
  end: TimeISO,
  businessHours?: BusinessHoursDay[],
): SlotBusinessHoursCheck {
  if (!businessHours || businessHours.length === 0) {
    return { valid: true };
  }

  const business = businessHours.find((b) => b.weekday === weekday);
  const dayLabel = WEEKDAY_LABELS_PT[weekday];

  if (!business || business.closed) {
    return {
      valid: false,
      reason: "CLOSED",
      message: `A unidade está configurada como fechada aos ${WEEKDAY_PLURAL_PT[weekday]}.`,
    };
  }

  const shifts: BusinessHoursShift[] =
    business.shifts && business.shifts.length > 0
      ? business.shifts
      : business.start && business.end
        ? [{ start: business.start, end: business.end }]
        : [];

  if (shifts.length === 0) {
    return {
      valid: false,
      reason: "NO_SHIFTS",
      message: `Nenhum turno de funcionamento configurado para ${dayLabel}.`,
    };
  }

  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  const fitsInAnyShift = shifts.some(
    (s) => startMin >= timeToMinutes(s.start) && endMin <= timeToMinutes(s.end),
  );

  if (!fitsInAnyShift) {
    const formattedShifts = shifts
      .map((s) => `${s.start} às ${s.end}`)
      .join(" e ");
    return {
      valid: false,
      reason: "OUTSIDE_SHIFTS",
      message: `Horário fora do expediente da unidade (${dayLabel} funciona das ${formattedShifts}).`,
    };
  }

  return { valid: true };
}

// --- Disponibilidade de slot -----------------------------------------------

export type SlotConflictCode =
  | "OUTSIDE_BUSINESS_HOURS"
  | "OUTSIDE_PROFESSIONAL_HOURS"
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
  // Overrides confirmados pelo usuario (regras "moles"): `allowBreak` pula a
  // checagem de almoco; `allowOutsideHours` pula a do horario do profissional;
  // `allowOutsideBusinessHours` pula a do expediente da unidade. Bloqueios e
  // sobreposicao NUNCA sao pulados.
  opts: {
    allowBreak?: boolean;
    allowOutsideHours?: boolean;
    allowOutsideBusinessHours?: boolean;
  } = {},
): SlotCheck {
  const weekday = weekdayOf(date);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  // Expediente da unidade: checado quando configurado. Pode ser pulado via
  // override administrativo (allowOutsideBusinessHours) para atender excecoes.
  if (ctx.businessHours.length > 0 && !opts.allowOutsideBusinessHours) {
    const business = ctx.businessHours.find((b) => b.weekday === weekday);
    if (!business || business.closed) {
      return { ok: false, code: "OUTSIDE_BUSINESS_HOURS" };
    }
    const shifts: BusinessHoursShift[] =
      business.shifts && business.shifts.length > 0
        ? business.shifts
        : business.start && business.end
          ? [{ start: business.start, end: business.end }]
          : [];

    if (shifts.length === 0) {
      return { ok: false, code: "OUTSIDE_BUSINESS_HOURS" };
    }
    const fitsInAnyShift = shifts.some(
      (s) => startMin >= timeToMinutes(s.start) && endMin <= timeToMinutes(s.end),
    );
    if (!fitsInAnyShift) {
      return { ok: false, code: "OUTSIDE_BUSINESS_HOURS" };
    }
  }

  // Disponibilidade do profissional: dia nao atendido ou fora do horario dele —
  // regra "mole", pulada com `allowOutsideHours` (confirmacao do usuario).
  const working = ctx.workingHours.find((w) => w.weekday === weekday);
  if (!opts.allowOutsideHours) {
    if (!working) {
      return { ok: false, code: "OUTSIDE_PROFESSIONAL_HOURS" };
    }
    if (startMin < timeToMinutes(working.start) || endMin > timeToMinutes(working.end)) {
      return { ok: false, code: "OUTSIDE_PROFESSIONAL_HOURS" };
    }
  }

  // Intervalo (almoco) do profissional: recusa slot que o cobre, salvo override.
  // So se aplica quando ha horario para o dia (fora do horario nao tem almoco).
  if (
    working &&
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

// --- Conflito de instrutor entre turmas ---------------------------------------

export interface InstructorSlotConflict {
  /** Encontro da turma sendo editada que conflita. */
  slot: ClassMeetingSlot;
  /** Turma ativa do mesmo instrutor que ja ocupa o horario. */
  group: Pick<ClassGroup, "id" | "name">;
  groupSlot: ClassMeetingSlot;
}

/**
 * Regra: o mesmo instrutor nao da aula em duas turmas ativas no mesmo dia com
 * horario sobreposto (outro instrutor pode). `excludeGroupId` ignora a propria
 * turma ao editar. Retorna um conflito por encontro de `slots`.
 */
export function findInstructorConflicts(
  slots: ClassMeetingSlot[],
  instructorId: string,
  groups: Pick<ClassGroup, "id" | "name" | "status" | "instructorId" | "meetingSlots">[],
  excludeGroupId?: string,
): InstructorSlotConflict[] {
  if (!instructorId) return [];
  const conflicts: InstructorSlotConflict[] = [];
  for (const slot of slots) {
    for (const group of groups) {
      if (group.id === excludeGroupId || group.status !== "active") continue;
      if (group.instructorId !== instructorId) continue;
      const groupSlot = group.meetingSlots.find(
        (s) => s.weekday === slot.weekday && rangesOverlap(slot.start, slot.end, s.start, s.end),
      );
      if (groupSlot) {
        conflicts.push({ slot, group: { id: group.id, name: group.name }, groupSlot });
        break;
      }
    }
  }
  return conflicts;
}

/** Mensagem da regra, igual no formulario e no service. */
export function instructorConflictMessage(
  instructorName: string,
  conflict: InstructorSlotConflict,
): string {
  const { groupSlot, group } = conflict;
  return `${instructorName} já dá aula ${WEEKDAY_LABELS_PT[groupSlot.weekday]} das ${groupSlot.start} às ${groupSlot.end} na turma "${group.name}". Escolha outro horário ou outro professor.`;
}
