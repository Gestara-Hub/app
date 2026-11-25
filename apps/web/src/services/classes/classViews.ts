import type {
  ClassGroup,
  ClassGroupView,
  ClassMeetingSlot,
  ClassSessionDetail,
  ClassSessionView,
  DateISO,
  Enrollment,
  EnrollmentCourseInstallments,
  EnrollmentView,
  Id,
  SessionRosterEntry,
  SessionRosterKind,
  TimeISO,
} from "@gestarahub/contracts";
import { classBillingMode, hasEnded, isCourseEnded, isFutureOpenInstallment } from "@gestarahub/core/billing";
import { isPastSlot } from "@gestarahub/core/date";
import { meetingSlotsOn, weekdayOf } from "@gestarahub/core/scheduling";
import { store } from "@/services/world/store";
import { acceptsPackages, packageCandidatesFor, packageRosterInfo } from "../billing";
import {
  todayISO,
  modalityName,
  instructorName,
  studentName,
  activeEnrollments,
  enrollmentsOn,
  SEP,
  makeSessionId,
  resolveSession,
  datesBetween,
  enrollmentOf,
} from "./classShared";

// Frequencia de um aluno numa turma, das presencas ja marcadas (o sessionId
// carrega o classGroupId como prefixo). justified nao entra no denominador.
export function frequencyOf(
  classGroupId: Id,
  studentId: Id,
): { presentCount: number; absentCount: number; attendanceRate: number | null } {
  const prefix = `${classGroupId}${SEP}`;
  let present = 0;
  let absent = 0;
  for (const a of store.attendances) {
    if (a.studentId !== studentId || !a.sessionId.startsWith(prefix)) continue;
    if (a.status === "present") present += 1;
    else if (a.status === "absent") absent += 1;
  }
  const total = present + absent;
  return {
    presentCount: present,
    absentCount: absent,
    attendanceRate: total > 0 ? present / total : null,
  };
}

export function toGroupView(g: ClassGroup): ClassGroupView {
  const enrolledCount = activeEnrollments(g.id).length;
  return {
    ...g,
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(g.instructorId),
    planName: g.planId
      ? store.plans.find((p) => p.id === g.planId)?.name
      : undefined,
    enrolledCount,
    // Ja teve matricula (de qualquer situacao): a cobranca da turma trava (25/11/2026).
    hasEnrollments: enrolledCount > 0 || store.enrollments.some((e) => e.classGroupId === g.id),
    availableSpots: g.capacity - enrolledCount,
    isEnded: hasEnded(g, todayISO()),
  };
}

/** Parcelas do curso da matricula por situacao (pagas, futuras, vencendo ou vencidas). */
function courseInstallmentsOf(enrollmentId: Id): EnrollmentCourseInstallments {
  const today = todayISO();
  const counts = { paid: 0, future: 0, due: 0 };
  for (const c of store.charges) {
    if (c.kind !== "course" || c.enrollmentId !== enrollmentId) continue;
    if (c.status === "paid") counts.paid += 1;
    else if (isFutureOpenInstallment(c, today)) counts.future += 1;
    else if (c.status === "pending" || c.status === "overdue") counts.due += 1;
  }
  return counts;
}

export function toEnrollmentView(e: Enrollment): EnrollmentView {
  const g = store.classGroups.find((x) => x.id === e.classGroupId);
  return {
    ...e,
    studentName: studentName(e.studentId),
    studentStatus: store.clients.find((c) => c.id === e.studentId)?.status ?? "inactive",
    ...frequencyOf(e.classGroupId, e.studentId),
    // Derivado na leitura: o curso acabou e o aluno seguiu ate o fim.
    isCompleted: e.status === "active" && Boolean(g && isCourseEnded(g, todayISO())),
    courseInstallments: e.course ? courseInstallmentsOf(e.id) : undefined,
  };
}

export function toSessionView(
  g: ClassGroup,
  date: DateISO,
  slot: ClassMeetingSlot,
): ClassSessionView {
  const sessionId = makeSessionId(g.id, date, slot.start);
  const overrides = store.sessionOverrides || [];
  const override = overrides.find((o) => o.sessionId === sessionId);

  const effectiveInstructorId = override?.instructorId ?? g.instructorId;
  const isSubstitute = Boolean(
    override?.instructorId && override.instructorId !== g.instructorId,
  );

  return {
    id: sessionId,
    classGroupId: g.id,
    date,
    start: slot.start,
    end: slot.end,
    instructorId: effectiveInstructorId,
    // Concluida quando o horario de fim ja passou (inclusive hoje).
    status: isPastSlot(date, slot.end) ? "done" : "scheduled",
    createdAt: g.createdAt,
    updatedAt: override?.updatedAt ?? g.updatedAt,
    className: g.name,
    modalityId: g.modalityId,
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(effectiveInstructorId),
    primaryInstructorId: g.instructorId,
    primaryInstructorName: instructorName(g.instructorId),
    isSubstitute,
    substitutionReason: override?.reason,
  };
}

// Roster da aula (mesma regra no detalhe e na ocupacao do calendario).
export function buildRoster(g: ClassGroup, id: Id, date: DateISO): SessionRosterEntry[] {
  // Roster unificado (híbrido):
  // 1. Alunos matriculados da turma
  // Quem tem presenca registrada nesta aula continua na lista, mesmo que a
  // matricula tenha mudado depois.
  const marked = new Set(
    store.attendances.filter((a) => a.sessionId === id).map((a) => a.studentId),
  );
  const onDate = enrollmentsOn(g.id, date);
  // Quem veio como avulso ou experimental e se matriculou depois segue como
  // reserva nesta aula (nao vira matriculado no passado nem gasta pacote).
  const reserved = new Set(
    store.reservations.filter((r) => r.sessionId === id && r.status === "reserved").map((r) => r.studentId),
  );
  const extra = store.enrollments.filter(
    (e) =>
      e.classGroupId === g.id &&
      marked.has(e.studentId) &&
      !reserved.has(e.studentId) &&
      !onDate.some((o) => o.studentId === e.studentId),
  );
  const enrolledEntries: SessionRosterEntry[] = [...onDate, ...extra].map(
    (e) => ({
      studentId: e.studentId,
      studentName: studentName(e.studentId),
      kind: "enrolled" as const,
      attendance: store.attendances.find(
        (a) => a.sessionId === id && a.studentId === e.studentId,
      )?.status,
    }),
  );

  // 2. Alunos com reserva na sessão específica (avulsos, experimentais)
  const reservedEntries: SessionRosterEntry[] = store.reservations
    .filter((r) => r.sessionId === id && r.status === "reserved")
    .filter((r) => !enrolledEntries.some((e) => e.studentId === r.studentId))
    .map((r) => ({
      studentId: r.studentId,
      studentName: studentName(r.studentId),
      kind: (r.kind || "dropin") as SessionRosterKind,
      attendance: store.attendances.find(
        (a) => a.sessionId === id && a.studentId === r.studentId,
      )?.status,
    }));

  // 3. Quem paga a aula com pacote (turma de pacote, matricula paga com pacote
  // ou vinculo "package"): saldo.
  const entries = [...enrolledEntries, ...reservedEntries].map((entry) =>
    paysWithPackage(g, entry.kind, entry.studentId)
      ? { ...entry, ...packageRosterInfo(entry.studentId, id, g, date) }
      : entry,
  );
  return entries.sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
}

/**
 * Paga esta aula com pacote: matriculado em turma de pacote, matriculado em
 * turma de mensalidade pagando com pacote ou inscrito na aula pelo pacote.
 * Avulso e experimental nunca (o avulso tem a cobranca dele).
 */
export function paysWithPackage(g: ClassGroup, kind: SessionRosterKind | undefined, studentId: Id): boolean {
  // Turma sem cobranca e curso nunca gastam pacote.
  if (kind === "package") return acceptsPackages(g);
  if (kind !== "enrolled") return false;
  const mode = classBillingMode(g);
  if (mode === "package") return true;
  return mode === "membership" && Boolean(enrollmentOf(g.id, studentId)?.paysWithPackage);
}

/** Aula do calendario com a ocupacao da data (matriculados vigentes + avulsos/experimentais). */
export type ClassSessionListItem = ClassSessionView & {
  capacity: number;
  occupiedCount: number;
};

/** Detalhe da aula, sincrono, para outros services (relatorios). Lanca NOT_FOUND. */
export function sessionDetailOf(id: Id): ClassSessionDetail {
  return buildSessionDetail(id);
}

/** Aulas de uma turma entre duas datas, na grade de cada data (relatorios). */
export function sessionsOfClass(
  g: ClassGroup,
  dateFrom: DateISO,
  dateTo: DateISO,
): { id: Id; date: DateISO; start: TimeISO }[] {
  const out: { id: Id; date: DateISO; start: TimeISO }[] = [];
  for (const date of datesBetween(dateFrom, dateTo)) {
    if (date < g.startDate || (g.endDate && date > g.endDate)) continue;
    const wd = weekdayOf(date);
    for (const slot of meetingSlotsOn(g, date)) {
      if (slot.weekday === wd) out.push({ id: makeSessionId(g.id, date, slot.start), date, start: slot.start });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function buildSessionDetail(id: Id): ClassSessionDetail {
  const { g, date, slot } = resolveSession(id);
  const view = toSessionView(g, date, slot);
  const roster = buildRoster(g, id, date);

  const capacity = g.capacity;
  const availableSpots = Math.max(0, capacity - roster.length);
  const allowDropin = g.allowDropin ?? true;

  return {
    ...view,
    enrollmentType: g.enrollmentType,
    capacity,
    availableSpots,
    allowDropin,
    sessionPriceCents: g.sessionPriceCents,
    roster,
    packageCandidates: packageCandidatesFor(
      g,
      date,
      new Set(roster.map((r) => r.studentId)),
    ),
  };
}
