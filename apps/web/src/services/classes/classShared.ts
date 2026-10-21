import type { ClassGroup, ClassMeetingSlot, DateISO, Enrollment, Id, TimeISO } from "@gestarahub/contracts";
import { meetingSlotsOn, weekdayOf } from "@gestarahub/core/scheduling";
import { addDays, format, parseISO } from "date-fns";
import { notFoundError } from "@/services/world/ops";
import { store } from "@/services/world/store";

/**
 * Modelo 3 (turmas) — Fatia 1. Sessoes/aulas sao GERADAS on-the-fly a partir dos
 * `meetingSlots` da turma (nao armazenadas); so a presenca e persistida, por um
 * sessionId deterministico (`classGroupId~date~start`).
 */

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

// Data LOCAL (yyyy-MM-dd) de um timestamp ISO. `.slice(0, 10)` pega a data UTC
// e erra o dia a noite (ex.: 22h em Brasilia ja e o dia seguinte em UTC).
function localDateOf(iso: string): DateISO {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export function modalityName(id?: Id): string | undefined {
  return id ? store.categories.find((c) => c.id === id)?.name : undefined;
}
export function instructorName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? "";
}
export function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}
export function activeEnrollments(classGroupId: Id): Enrollment[] {
  return store.enrollments.filter(
    (e) => e.classGroupId === classGroupId && e.status === "active",
  );
}

/**
 * Matriculas vigentes numa data: matriculado ate o dia e nao cancelado antes
 * dele. Aulas passadas mostram quem estava na turma naquele dia, nao hoje.
 */
export function enrollmentsOn(classGroupId: Id, date: DateISO): Enrollment[] {
  return store.enrollments.filter(
    (e) =>
      e.classGroupId === classGroupId &&
      localDateOf(e.enrolledAt) <= date &&
      (e.status === "active" || (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date)),
  );
}

/** "2026-11-30" -> "30/11/2026". */
export function brDate(iso: DateISO): string {
  return iso.split("-").reverse().join("/");
}

// Sessao gerada: id deterministico para a presenca se ancorar.
export const SEP = "~";
export function makeSessionId(classGroupId: Id, date: DateISO, start: TimeISO): Id {
  return [classGroupId, date, start].join(SEP);
}
export function parseSessionId(
  id: Id,
): { classGroupId: Id; date: DateISO; start: TimeISO } | null {
  const parts = id.split(SEP);
  if (parts.length !== 3) return null;
  return { classGroupId: parts[0], date: parts[1], start: parts[2] };
}

/** Data real no formato yyyy-MM-dd (31/02 ou texto solto nao valem). */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime()) && format(parsed, "yyyy-MM-dd") === value;
}

/**
 * Aula que existe de verdade: data valida, dentro do inicio e do fim da turma,
 * no dia da semana e no horario da grade daquela data (mudar o horario nao
 * apaga as aulas passadas) e, em turma desativada, so as que ja passaram.
 */
export function resolveSession(id: Id): { g: ClassGroup; date: DateISO; slot: ClassMeetingSlot } {
  const notFound = () => notFoundError("Aula não encontrada.");
  const p = parseSessionId(id);
  if (!p || !isRealDate(p.date)) throw notFound();
  const g = store.classGroups.find((x) => x.id === p.classGroupId);
  if (!g) throw notFound();
  if (p.date < g.startDate || (g.endDate && p.date > g.endDate)) throw notFound();
  if (g.status !== "active" && p.date > todayISO()) throw notFound();
  const wd = weekdayOf(p.date);
  const slot = meetingSlotsOn(g, p.date).find((s) => s.weekday === wd && s.start === p.start);
  if (!slot) throw notFound();
  return { g, date: p.date, slot };
}

export function datesBetween(from: DateISO, to: DateISO): DateISO[] {
  const out: DateISO[] = [];
  let d = parseISO(from);
  const end = parseISO(to);
  // Trava de seguranca (~1 ano) para janelas mal formadas.
  for (let i = 0; d.getTime() <= end.getTime() && i < 400; i++) {
    out.push(format(d, "yyyy-MM-dd"));
    d = addDays(d, 1);
  }
  return out;
}

/** Periodo que ainda vai acontecer: de hoje (ou do inicio, se for depois) ao fim. */
export function upcomingPeriod(startDate: DateISO, endDate?: DateISO) {
  const today = todayISO();
  return { startDate: startDate > today ? startDate : today, endDate };
}

/** Matricula do aluno na turma: a ativa ou, sem ela, a ultima (presenca antiga). */
export function enrollmentOf(classGroupId: Id, studentId: Id): Enrollment | undefined {
  const rows = store.enrollments.filter((e) => e.classGroupId === classGroupId && e.studentId === studentId);
  return rows.find((e) => e.status === "active") ?? rows[rows.length - 1];
}
