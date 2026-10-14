import type {
  ApiErrorField,
  AttendanceStatus,
  AttendanceSummary,
  AbsenceStreakView,
  Charge,
  ClassGroup,
  ClassGroupFilter,
  ClassGroupView,
  ClassMeetingSlot,
  ClassReservation,
  ClassSessionDetail,
  ClassSessionView,
  CreateClassGroup,
  CreateEnrollment,
  DateISO,
  Enrollment,
  EnrollmentCourseChoice,
  EnrollmentCourseInstallments,
  EnrollmentView,
  Id,
  ReservationKind,
  ReservationView,
  SessionRosterEntry,
  SessionRosterKind,
  SubstituteInstructorPayload,
  TimeISO,
  UpdateClassGroup,
  WaitlistEntry,
  WaitlistEntryView,
} from "@gestarahub/contracts";
import { addDays, format, parseISO } from "date-fns";
import {
  checkSlotWithinBusinessHours,
  findInstructorConflicts,
  instructorConflictMessage,
  weekdayOf,
} from "@gestarahub/core/scheduling";
import { isPastSlot } from "@gestarahub/core/date";
import {
  classBillingMode,
  hasEnded,
  isCourseEnded,
  isFutureOpenInstallment,
  MAX_INSTALLMENTS,
  splitInstallments,
} from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
import { cancelOnlinePaymentsForCharge } from "./onlinePaymentsService";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";

/**
 * Modelo 3 (turmas) — Fatia 1. Sessoes/aulas sao GERADAS on-the-fly a partir dos
 * `meetingSlots` da turma (nao armazenadas); so a presenca e persistida, por um
 * sessionId deterministico (`classGroupId~date~start`).
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

// Data LOCAL (yyyy-MM-dd) de um timestamp ISO. `.slice(0, 10)` pega a data UTC
// e erra o dia a noite (ex.: 22h em Brasilia ja e o dia seguinte em UTC).
function localDateOf(iso: string): DateISO {
  return format(parseISO(iso), "yyyy-MM-dd");
}

function modalityName(id?: Id): string | undefined {
  return id ? store.categories.find((c) => c.id === id)?.name : undefined;
}
function instructorName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? "";
}
function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}
function activeEnrollments(classGroupId: Id): Enrollment[] {
  return store.enrollments.filter(
    (e) => e.classGroupId === classGroupId && e.status === "active",
  );
}

/**
 * Matriculas vigentes numa data: matriculado ate o dia e nao cancelado antes
 * dele. Aulas passadas mostram quem estava na turma naquele dia, nao hoje.
 */
function enrollmentsOn(classGroupId: Id, date: DateISO): Enrollment[] {
  return store.enrollments.filter(
    (e) =>
      e.classGroupId === classGroupId &&
      localDateOf(e.enrolledAt) <= date &&
      (e.status === "active" || (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date)),
  );
}

// Frequencia de um aluno numa turma, das presencas ja marcadas (o sessionId
// carrega o classGroupId como prefixo). justified nao entra no denominador.
function frequencyOf(
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

function toGroupView(g: ClassGroup): ClassGroupView {
  const enrolledCount = activeEnrollments(g.id).length;
  return {
    ...g,
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(g.instructorId),
    planName: g.planId
      ? store.plans.find((p) => p.id === g.planId)?.name
      : undefined,
    enrolledCount,
    availableSpots: g.capacity - enrolledCount,
    vagasRestantes: g.capacity - enrolledCount,
    isEnded: hasEnded(g, todayISO()),
  };
}

/** "2026-11-30" -> "30/11/2026". */
function brDate(iso: DateISO): string {
  return iso.split("-").reverse().join("/");
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

function toEnrollmentView(e: Enrollment): EnrollmentView {
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

// Sessao gerada: id deterministico para a presenca se ancorar.
const SEP = "~";
function makeSessionId(classGroupId: Id, date: DateISO, start: TimeISO): Id {
  return [classGroupId, date, start].join(SEP);
}
function parseSessionId(
  id: Id,
): { classGroupId: Id; date: DateISO; start: TimeISO } | null {
  const parts = id.split(SEP);
  if (parts.length !== 3) return null;
  return { classGroupId: parts[0], date: parts[1], start: parts[2] };
}

function toSessionView(
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
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(effectiveInstructorId),
    primaryInstructorId: g.instructorId,
    primaryInstructorName: instructorName(g.instructorId),
    isSubstitute,
    substitutionReason: override?.reason,
  };
}

function datesBetween(from: DateISO, to: DateISO): DateISO[] {
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


// Verifica se dois horários se sobrepõem (qualquer minuto em comum é conflito).
function timesOverlap(
  start1: TimeISO,
  end1: TimeISO,
  start2: TimeISO,
  end2: TimeISO,
): boolean {
  return start1 < end2 && end1 > start2;
}

// Valida conflito de horário: instrutor não pode estar em duas turmas no mesmo dia/hora
// (regra em @gestarahub/core/scheduling, a mesma que o formulário mostra ao vivo).
function validateInstructorScheduleConflict(
  payload: Partial<CreateClassGroup>,
  currentGroupId?: Id,
): void {
  if (!payload.instructorId || !payload.meetingSlots) return;
  const [conflict] = findInstructorConflicts(
    payload.meetingSlots,
    payload.instructorId,
    store.classGroups,
    currentGroupId,
  );
  if (!conflict) return;
  const instructor = store.professionals.find((p) => p.id === payload.instructorId);
  const fields: ApiErrorField[] = [
    {
      field: "meetingSlots",
      message: instructorConflictMessage(instructor?.name ?? "O instrutor", conflict),
    },
  ];
  throw validationError(fields);
}

// Valida se o aluno já está em outra turma com horário conflitante (mesmo dia/hora).
function validateStudentScheduleConflict(
  studentId: Id,
  targetClassGroupId: Id,
): void {
  const targetGroup = store.classGroups.find((g) => g.id === targetClassGroupId);
  if (!targetGroup || targetGroup.status !== "active") return;

  const student = store.clients.find((c) => c.id === studentId);
  const studentName = student?.name ?? "Aluno";

  const otherActiveEnrollments = store.enrollments.filter(
    (e) =>
      e.studentId === studentId &&
      e.status === "active" &&
      e.classGroupId !== targetClassGroupId,
  );

  for (const slot of targetGroup.meetingSlots) {
    for (const enrollment of otherActiveEnrollments) {
      const otherGroup = store.classGroups.find(
        (g) => g.id === enrollment.classGroupId && g.status === "active",
      );
      if (!otherGroup) continue;

      const conflictSlot = otherGroup.meetingSlots.find(
        (s) =>
          s.weekday === slot.weekday &&
          timesOverlap(slot.start, slot.end, s.start, s.end),
      );

      if (conflictSlot) {
        const dayName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
          slot.weekday
        ];
        throw apiError(
          "CLASS_SCHEDULE_CONFLICT",
          `${studentName} já possui aula ${dayName} (${conflictSlot.start}-${conflictSlot.end}) na turma "${otherGroup.name}".`,
          { httpStatus: 409 },
        );
      }
    }
  }
}

// Valida se os encontros da turma estão dentro do expediente da unidade.
function validateMeetingSlotsBusinessHours(slots?: ClassMeetingSlot[]): void {
  if (!slots || slots.length === 0) return;
  const businessHours = store.unit.businessHours;
  if (!businessHours || businessHours.length === 0) return;

  for (const slot of slots) {
    const check = checkSlotWithinBusinessHours(
      slot.weekday,
      slot.start,
      slot.end,
      businessHours,
    );
    if (!check.valid && check.message) {
      throw validationError([
        {
          field: "meetingSlots",
          message: check.message,
        },
      ]);
    }
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is DateISO {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(parseISO(value).getTime());
}

/**
 * Forma de cobranca da turma. Curso: valor > 0, de 1 a 12 parcelas e data de
 * fim obrigatoria. Fim no mesmo dia do inicio vale (oficina de um dia).
 */
function billingFieldErrors(payload: Partial<CreateClassGroup>): ApiErrorField[] {
  const fields: ApiErrorField[] = [];
  const isCourse = classBillingMode(payload) === "course";
  if (isCourse) {
    const price = payload.coursePriceCents;
    if (!Number.isInteger(price) || (price ?? 0) <= 0) {
      fields.push({ field: "coursePriceCents", message: "Informe o valor do curso." });
    }
    const max = payload.courseMaxInstallments;
    if (!Number.isInteger(max) || (max ?? 0) < 1 || (max ?? 0) > MAX_INSTALLMENTS) {
      fields.push({ field: "courseMaxInstallments", message: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
    }
  }
  if (payload.endDate !== undefined && payload.endDate !== "" && !isValidDate(payload.endDate)) {
    fields.push({ field: "endDate", message: "Informe uma data válida." });
  } else if (isCourse && !payload.endDate) {
    fields.push({ field: "endDate", message: "Informe quando o curso termina." });
  } else if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
    fields.push({
      field: "endDate",
      message: isCourse ? "O curso não pode terminar antes de começar." : "A turma não pode terminar antes de começar.",
    });
  }
  return fields;
}

/**
 * Campos de cobranca coerentes com a forma: valor e parcelas so no curso; o
 * plano legado da turma so na mensalidade (curso e sem cobranca nunca geram
 * mensalidade pela turma).
 */
function normalizeBilling<T extends Partial<CreateClassGroup>>(payload: T): T {
  const mode = classBillingMode(payload);
  return {
    ...payload,
    endDate: payload.endDate || undefined,
    coursePriceCents: mode === "course" ? payload.coursePriceCents : undefined,
    courseMaxInstallments: mode === "course" ? payload.courseMaxInstallments : undefined,
    planId: mode === "membership" ? payload.planId : undefined,
  };
}

/**
 * Valida o pagamento do curso escolhido na matricula. Turma que nao e curso
 * ignora; curso sem escolha, terminado, valor zero, parcelas fora de 1..maximo
 * da turma ou vencimento invalido e recusado.
 */
function resolveCourseChoice(g: ClassGroup, choice?: EnrollmentCourseChoice): EnrollmentCourseChoice | undefined {
  if (classBillingMode(g) !== "course") return undefined;
  if (isCourseEnded(g, todayISO())) {
    throw apiError("VALIDATION", `Este curso já terminou (${brDate(g.endDate ?? "")}).`, { httpStatus: 422 });
  }
  if (!choice) {
    throw validationError([{ field: "course", message: "Informe o pagamento do curso." }]);
  }
  const fields: ApiErrorField[] = [];
  const max = g.courseMaxInstallments ?? 1;
  if (!Number.isInteger(choice.priceCents) || choice.priceCents <= 0) {
    fields.push({ field: "course.priceCents", message: "Informe o valor do curso." });
  }
  if (!Number.isInteger(choice.installments) || choice.installments < 1 || choice.installments > max) {
    fields.push({
      field: "course.installments",
      message: max === 1 ? "Este curso é só à vista." : `Escolha de 1 a ${max} parcelas.`,
    });
  } else if (Number.isInteger(choice.priceCents) && choice.priceCents > 0 && choice.priceCents < choice.installments) {
    // Parcela de R$ 0 nao e cobranca.
    fields.push({ field: "course.installments", message: "Cada parcela precisa de pelo menos R$ 0,01." });
  }
  if (!isValidDate(choice.firstDueDate)) {
    fields.push({ field: "course.firstDueDate", message: "Informe o 1º vencimento." });
  }
  if (fields.length > 0) throw validationError(fields);
  return { priceCents: choice.priceCents, installments: choice.installments, firstDueDate: choice.firstDueDate };
}

/**
 * Matricula ativa + parcelas do curso (se for curso), com auditoria. Unica
 * escrita de matricula: matricular e promover da lista de espera passam aqui.
 */
function createEnrollment(g: ClassGroup, studentId: Id, course?: EnrollmentCourseChoice): Enrollment {
  const ts = nowIso();
  const enrollment: Enrollment = {
    id: newId(),
    classGroupId: g.id,
    studentId,
    status: "active",
    enrolledAt: ts,
  };
  const name = studentName(studentId);
  if (course) {
    const installmentGroupId = newId();
    enrollment.course = { ...course, installmentGroupId };
    const parts = splitInstallments(course.priceCents, course.installments, course.firstDueDate);
    store.charges.push(
      ...parts.map(
        (part): Charge => ({
          id: newId(),
          organizationId: store.organization.id,
          unitId: g.unitId,
          studentId,
          kind: "course",
          classGroupId: g.id,
          enrollmentId: enrollment.id,
          description: g.name,
          installmentGroupId,
          competence: part.dueDate.slice(0, 7),
          dueDate: part.dueDate,
          amountCents: part.amountCents,
          status: "pending",
          cycleIndex: part.index,
          cycleTotal: part.total,
          createdAt: ts,
          updatedAt: ts,
        }),
      ),
    );
  }
  store.enrollments.push(enrollment);
  auditLogService.record({
    action: "created",
    target: { type: "enrollment", id: enrollment.id, label: `${name} em ${g.name}` },
    predicate: course
      ? `matriculou ${name} no curso ${g.name} (${formatCents(course.priceCents)}${course.installments > 1 ? `, em ${course.installments} parcelas` : ""})`
      : `matriculou ${name} na turma ${g.name}`,
  });
  return enrollment;
}

function validateGroup(payload: Partial<CreateClassGroup>, currentGroupId?: Id): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome da turma." });
  }
  if (!payload.modalityId) {
    fields.push({ field: "modalityId", message: "Selecione a modalidade da turma." });
  }
  if (!payload.instructorId) {
    fields.push({ field: "instructorId", message: "Selecione o instrutor." });
  }
  if (!payload.meetingSlots || payload.meetingSlots.length === 0) {
    fields.push({ field: "meetingSlots", message: "Informe ao menos um encontro." });
  }
  if (payload.capacity === undefined || payload.capacity < 1) {
    fields.push({ field: "capacity", message: "A capacidade deve ser ao menos 1." });
  }
  fields.push(...billingFieldErrors(payload));
  if (fields.length > 0) throw validationError(fields);

  // Valida se os encontros estão dentro do expediente da unidade.
  validateMeetingSlotsBusinessHours(payload.meetingSlots);

  // Valida conflito de horário do instrutor (executado após validações básicas).
  validateInstructorScheduleConflict(payload, currentGroupId);
}

// Roster da aula (mesma regra no detalhe e na ocupacao do calendario).
function buildRoster(g: ClassGroup, id: Id, date: DateISO): SessionRosterEntry[] {
  // Roster unificado (híbrido):
  // 1. Alunos matriculados da turma
  // Quem tem presenca registrada nesta aula continua na lista, mesmo que a
  // matricula tenha mudado depois.
  const marked = new Set(
    store.attendances.filter((a) => a.sessionId === id).map((a) => a.studentId),
  );
  const onDate = enrollmentsOn(g.id, date);
  const extra = store.enrollments.filter(
    (e) => e.classGroupId === g.id && marked.has(e.studentId) && !onDate.some((o) => o.studentId === e.studentId),
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

  return [...enrolledEntries, ...reservedEntries].sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "pt-BR"),
  );
}

/** Aula do calendario com a ocupacao da data (matriculados vigentes + avulsos/experimentais). */
export type ClassSessionListItem = ClassSessionView & {
  capacity: number;
  occupiedCount: number;
};

function buildSessionDetail(id: Id): ClassSessionDetail {
  const p = parseSessionId(id);
  const g = p
    ? store.classGroups.find((x) => x.id === p.classGroupId)
    : undefined;
  if (!p || !g) throw notFoundError("Aula não encontrada.");
  const slot = g.meetingSlots.find((s) => s.start === p.start);
  if (!slot) throw notFoundError("Aula não encontrada.");
  const view = toSessionView(g, p.date, slot);
  const roster = buildRoster(g, id, p.date);

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
  };
}

// Renumera a fila (1..n) de quem ainda espera, na ordem atual.
function renumberWaitlist(classGroupId: Id): void {
  store.waitlist
    .filter((w) => w.classGroupId === classGroupId && w.status === "waiting")
    .sort((a, b) => a.position - b.position)
    .forEach((w, i) => {
      w.position = i + 1;
    });
}

// Aulas que o instrutor da de fato numa data: as turmas dele (sem override para
// outro) + as aulas de outras turmas em que ele e substituto naquela data.
function instructorSessionsOn(
  instructorId: Id,
  date: DateISO,
  excludeSessionId: Id,
): { group: ClassGroup; slot: ClassMeetingSlot }[] {
  const wd = weekdayOf(date);
  const overrides = store.sessionOverrides || [];
  const out: { group: ClassGroup; slot: ClassMeetingSlot }[] = [];
  for (const g of store.classGroups) {
    if (g.status !== "active" || date < g.startDate) continue;
    if (g.endDate && date > g.endDate) continue;
    for (const slot of g.meetingSlots) {
      if (slot.weekday !== wd) continue;
      const sid = makeSessionId(g.id, date, slot.start);
      if (sid === excludeSessionId) continue;
      const effective = overrides.find((o) => o.sessionId === sid)?.instructorId ?? g.instructorId;
      if (effective === instructorId) out.push({ group: g, slot });
    }
  }
  return out;
}

// Substituto nao pode estar em outra aula sobreposta na mesma data.
function validateSubstituteConflict(
  sessionId: Id,
  date: DateISO,
  slot: ClassMeetingSlot,
  instructorId: Id,
  name: string,
): void {
  // Cada aula vira uma "turma" de um encontro so para reusar a regra do core.
  const busy = instructorSessionsOn(instructorId, date, sessionId).map(({ group, slot: s }) => ({
    id: group.id,
    name: group.name,
    status: "active" as const,
    instructorId,
    meetingSlots: [s],
  }));
  const [conflict] = findInstructorConflicts([slot], instructorId, busy);
  if (conflict) {
    throw apiError("CLASS_SCHEDULE_CONFLICT", instructorConflictMessage(name, conflict), {
      httpStatus: 409,
    });
  }
}

export const turmasService = {
  list(filter?: ClassGroupFilter): Promise<ClassGroupView[]> {
    return simulateRead(() => {
      let result = store.classGroups;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((g) => textIncludes(g.name, term));
      }
      if (filter?.modalityId) {
        result = result.filter((g) => g.modalityId === filter.modalityId);
      }
      if (filter?.instructorId) {
        result = result.filter((g) => g.instructorId === filter.instructorId);
      }
      if (filter?.status) {
        result = result.filter((g) => g.status === filter.status);
      }
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toGroupView),
      );
    });
  },

  getById(id: Id): Promise<ClassGroupView> {
    return simulateRead(() => {
      const g = store.classGroups.find((x) => x.id === id);
      if (!g) throw notFoundError("Turma não encontrada.");
      return clone(toGroupView(g));
    });
  },

  create(input: CreateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(() => {
      const payload = normalizeBilling(input);
      validateGroup(payload, undefined);
      const ts = nowIso();
      const g: ClassGroup = {
        ...payload,
        organizationId: store.organization.id,
        unitId: store.unit.id,
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      store.classGroups.push(g);
      auditLogService.record({
        action: "created",
        target: { type: "class_group", id: g.id, label: g.name },
        predicate: `criou a turma ${g.name}`,
      });
      return clone(toGroupView(g));
    });
  },

  update(id: Id, payload: UpdateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(() => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      // Mudar a forma ou o valor nao mexe nas parcelas das matriculas ja feitas.
      const next = normalizeBilling({ ...store.classGroups[idx], ...payload });
      validateGroup(next, id);
      store.classGroups[idx] = {
        ...next,
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id, label: store.classGroups[idx].name },
        predicate: `atualizou a turma ${store.classGroups[idx].name}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // Desativa uma turma (soft delete): preserva histórico, impede novas sessões.
  deactivate(id: Id): Promise<ClassGroupView> {
    return simulateWrite(() => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      if (g.status === "inactive") {
        throw validationError([
          { field: "status", message: "Turma já foi desativada." },
        ]);
      }
      store.classGroups[idx] = {
        ...g,
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "class_group", id, label: g.name },
        predicate: `desativou a turma ${g.name}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // Reativa uma turma desativada.
  reactivate(id: Id): Promise<ClassGroupView> {
    return simulateWrite(() => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      // Enquanto inativa, o horario pode ter sido ocupado por outra turma do instrutor.
      const [conflict] = findInstructorConflicts(
        g.meetingSlots,
        g.instructorId,
        store.classGroups,
        g.id,
      );
      if (conflict) {
        throw apiError(
          "CLASS_SCHEDULE_CONFLICT",
          instructorConflictMessage(instructorName(g.instructorId) || "O instrutor", conflict),
          { httpStatus: 409 },
        );
      }
      store.classGroups[idx] = {
        ...g,
        status: "active",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "activated",
        target: { type: "class_group", id, label: g.name },
        predicate: `reativou a turma ${g.name}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // --- Matriculas ---------------------------------------------------------
  listEnrollments(classGroupId: Id): Promise<EnrollmentView[]> {
    return simulateRead(() => {
      const rows = store.enrollments.filter(
        (e) => e.classGroupId === classGroupId && e.status !== "canceled",
      );
      return clone(
        rows
          .map(toEnrollmentView)
          .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  // Capacidade e regra MOLE: com a turma lotada, lanca CLASS_FULL; o form pede
  // confirmacao e reenvia com `allowOverCapacity`. Curso exige `payload.course`
  // e gera as parcelas na hora (doc 20, fase B).
  enroll(
    payload: CreateEnrollment,
    opts: { allowOverCapacity?: boolean } = {},
  ): Promise<EnrollmentView> {
    return simulateWrite(() => {
      const g = store.classGroups.find((x) => x.id === payload.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const student = store.clients.find((c) => c.id === payload.studentId);
      if (!student) {
        throw validationError([{ field: "studentId", message: "Selecione um aluno." }]);
      }
      const already = store.enrollments.find(
        (e) =>
          e.classGroupId === g.id &&
          e.studentId === payload.studentId &&
          e.status === "active",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já matriculado nesta turma." },
        ]);
      }
      validateStudentScheduleConflict(payload.studentId, g.id);
      const course = resolveCourseChoice(g, payload.course);
      if (!opts.allowOverCapacity && activeEnrollments(g.id).length >= g.capacity) {
        throw apiError("CLASS_FULL", `Turma lotada (${g.capacity} vagas).`, {
          httpStatus: 409,
        });
      }
      const enrollment = createEnrollment(g, student.id, course);
      return clone(toEnrollmentView(enrollment));
    });
  },

  cancelEnrollment(id: Id, reason?: string): Promise<void> {
    return simulateWrite(() => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e) throw notFoundError("Matrícula não encontrada.");
      if (e.status === "canceled") {
        throw apiError("VALIDATION", "Esta matrícula já foi cancelada.", { httpStatus: 409 });
      }
      e.status = "canceled";
      e.canceledAt = nowIso();
      e.cancellationReason = reason?.trim() || undefined;
      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      const turma = g?.name ?? "";
      // Curso (decisao 1 do doc 20): pagas ficam, as futuras saem e as que ja
      // venceram seguem como divida. Curso ja concluido nao cancela nada (foi dado).
      let canceledInstallments = 0;
      if (e.course && !(g && isCourseEnded(g, todayISO()))) {
        const today = todayISO();
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "course" || c.enrollmentId !== e.id || !isFutureOpenInstallment(c, today)) continue;
          c.status = "canceled";
          c.canceledBy = "system";
          c.cancelReason = "Matrícula cancelada";
          c.updatedAt = ts;
          cancelOnlinePaymentsForCharge(c.id);
          canceledInstallments += 1;
        }
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id, label: `${studentName(e.studentId)} em ${turma}` },
        predicate: e.course
          ? `cancelou a matrícula de ${studentName(e.studentId)} no curso ${turma}${canceledInstallments > 0 ? ` e ${plural(canceledInstallments, "parcela futura", "parcelas futuras")}` : ""}`
          : `cancelou a matrícula de ${studentName(e.studentId)} na turma ${turma}`,
      });
    });
  },

  // --- Sessoes (geradas) + presenca --------------------------------------
  listSessions(filter: {
    classGroupId?: Id;
    dateFrom: DateISO;
    dateTo: DateISO;
  }): Promise<ClassSessionListItem[]> {
    return simulateRead(() => {
      const groups = store.classGroups.filter(
        (g) =>
          g.status === "active" &&
          (!filter.classGroupId || g.id === filter.classGroupId),
      );
      const out: ClassSessionListItem[] = [];
      for (const date of datesBetween(filter.dateFrom, filter.dateTo)) {
        const wd = weekdayOf(date);
        for (const g of groups) {
          if (date < g.startDate) continue;
          if (g.endDate && date > g.endDate) continue;
          for (const slot of g.meetingSlots) {
            if (slot.weekday !== wd) continue;
            const view = toSessionView(g, date, slot);
            out.push({
              ...view,
              capacity: g.capacity,
              occupiedCount: buildRoster(g, view.id, date).length,
            });
          }
        }
      }
      return clone(
        out.sort(
          (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
        ),
      );
    });
  },

  getSession(id: Id): Promise<ClassSessionDetail> {
    return simulateRead(() => clone(buildSessionDetail(id)));
  },

  markAttendance(input: {
    sessionId: Id;
    studentId: Id;
    status: AttendanceStatus;
  }): Promise<void> {
    return simulateWrite(() => {
      const date = parseSessionId(input.sessionId)?.date;
      if (date && date > todayISO()) {
        throw apiError("VALIDATION", "A chamada só pode ser feita no dia da aula ou depois.", {
          httpStatus: 422,
        });
      }
      const existing = store.attendances.find(
        (a) => a.sessionId === input.sessionId && a.studentId === input.studentId,
      );
      if (existing) {
        existing.status = input.status;
        existing.markedAt = nowIso();
      } else {
        store.attendances.push({
          id: newId(),
          sessionId: input.sessionId,
          studentId: input.studentId,
          status: input.status,
          markedAt: nowIso(),
        });
      }
    });
  },

  getAttendanceSummary(date: DateISO): Promise<AttendanceSummary> {
    return simulateRead(() => {
      let present = 0;
      let absent = 0;
      let justified = 0;
      for (const a of store.attendances) {
        const p = parseSessionId(a.sessionId);
        if (p && p.date === date) {
          if (a.status === "present") present += 1;
          else if (a.status === "absent") absent += 1;
          else if (a.status === "justified") justified += 1;
        }
      }
      return {
        present,
        absent,
        justified,
        total: present + absent + justified,
      };
    });
  },

  /** Pares aluno x modalidade das matriculas ativas (uma linha por par). */
  listEnrolledModalities(): Promise<{ studentId: Id; modalityId: Id }[]> {
    return simulateRead(() => {
      const modalityByGroup = new Map(store.classGroups.map((g) => [g.id, g.modalityId]));
      const seen = new Set<string>();
      const pairs: { studentId: Id; modalityId: Id }[] = [];
      for (const e of store.enrollments) {
        if (e.status !== "active") continue;
        const modalityId = modalityByGroup.get(e.classGroupId);
        if (!modalityId || seen.has(`${e.studentId}~${modalityId}`)) continue;
        seen.add(`${e.studentId}~${modalityId}`);
        pairs.push({ studentId: e.studentId, modalityId });
      }
      return pairs;
    });
  },

  /**
   * Alunos ativos com pelo menos `minStreak` faltas seguidas nas turmas em que
   * estao matriculados (so aulas com chamada feita). Presenca ou falta
   * justificada encerram a sequencia. Mais faltas primeiro.
   */
  listAbsenceStreaks(minStreak = 3): Promise<AbsenceStreakView[]> {
    return simulateRead(() => {
      const groupsByStudent = new Map<Id, Set<Id>>();
      for (const e of store.enrollments) {
        if (e.status !== "active") continue;
        const set = groupsByStudent.get(e.studentId) ?? new Set<Id>();
        set.add(e.classGroupId);
        groupsByStudent.set(e.studentId, set);
      }
      const result: AbsenceStreakView[] = [];
      for (const [studentId, groupIds] of groupsByStudent) {
        const client = store.clients.find((c) => c.id === studentId && c.status === "active");
        if (!client) continue;
        const marks = store.attendances
          .filter((a) => a.studentId === studentId)
          .map((a) => ({ status: a.status, session: parseSessionId(a.sessionId) }))
          .filter((m): m is { status: AttendanceStatus; session: NonNullable<ReturnType<typeof parseSessionId>> } =>
            Boolean(m.session && groupIds.has(m.session.classGroupId)),
          )
          .sort((a, b) => `${b.session.date}${b.session.start}`.localeCompare(`${a.session.date}${a.session.start}`));
        let streak = 0;
        let since = "";
        const groups = new Set<Id>();
        for (const m of marks) {
          if (m.status !== "absent") break;
          streak += 1;
          since = m.session.date;
          groups.add(m.session.classGroupId);
        }
        if (streak < minStreak) continue;
        result.push({
          studentId,
          studentName: client.name,
          ...(client.phone ? { phone: client.phone } : {}),
          streak,
          since,
          classGroupNames: [...groups]
            .map((id) => store.classGroups.find((g) => g.id === id)?.name)
            .filter((n): n is string => Boolean(n)),
        });
      }
      return result.sort((a, b) => b.streak - a.streak || a.studentName.localeCompare(b.studentName, "pt-BR"));
    });
  },

  substituteInstructor(
    sessionId: Id,
    payload: SubstituteInstructorPayload,
  ): Promise<ClassSessionDetail> {
    return simulateWrite(() => {
      const p = parseSessionId(sessionId);
      if (!p) throw notFoundError("Aula não encontrada.");
      const g = store.classGroups.find((x) => x.id === p.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");

      const instructor = store.professionals.find((x) => x.id === payload.instructorId);
      if (!instructor) throw notFoundError("Instrutor não encontrado.");
      const slot = g.meetingSlots.find((s) => s.start === p.start);
      if (!slot) throw notFoundError("Aula não encontrada.");
      validateSubstituteConflict(sessionId, p.date, slot, instructor.id, instructor.name);

      if (!store.sessionOverrides) {
        store.sessionOverrides = [];
      }

      const existingIndex = store.sessionOverrides.findIndex(
        (o) => o.sessionId === sessionId,
      );
      const ts = nowIso();

      if (existingIndex !== -1) {
        store.sessionOverrides[existingIndex] = {
          sessionId,
          instructorId: payload.instructorId,
          reason: payload.reason?.trim() || undefined,
          createdAt: store.sessionOverrides[existingIndex].createdAt,
          updatedAt: ts,
        };
      } else {
        store.sessionOverrides.push({
          sessionId,
          instructorId: payload.instructorId,
          reason: payload.reason?.trim() || undefined,
          createdAt: ts,
          updatedAt: ts,
        });
      }

      return clone(buildSessionDetail(sessionId));
    });
  },

  restorePrimaryInstructor(sessionId: Id): Promise<ClassSessionDetail> {
    return simulateWrite(() => {
      if (store.sessionOverrides) {
        const idx = store.sessionOverrides.findIndex(
          (o) => o.sessionId === sessionId,
        );
        if (idx !== -1) {
          store.sessionOverrides.splice(idx, 1);
        }
      }
      return clone(buildSessionDetail(sessionId));
    });
  },

  // --- Lista de espera ----------------------------------------------------
  listWaitlist(classGroupId: Id): Promise<WaitlistEntryView[]> {
    return simulateRead(() => {
      const rows = store.waitlist.filter(
        (w) => w.classGroupId === classGroupId && w.status === "waiting",
      );
      return clone(
        rows
          .sort((a, b) => a.position - b.position)
          .map((w) => ({ ...w, studentName: studentName(w.studentId) })),
      );
    });
  },

  addToWaitlist(input: {
    classGroupId: Id;
    studentId: Id;
  }): Promise<WaitlistEntryView> {
    return simulateWrite(() => {
      const g = store.classGroups.find((x) => x.id === input.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const already = store.waitlist.find(
        (w) =>
          w.classGroupId === g.id &&
          w.studentId === input.studentId &&
          w.status === "waiting",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já está na lista de espera." },
        ]);
      }
      // Maior posicao + 1: nunca repete, mesmo apos remocoes/promocoes.
      const position =
        store.waitlist
          .filter((w) => w.classGroupId === g.id && w.status === "waiting")
          .reduce((max, w) => Math.max(max, w.position), 0) + 1;
      const entry: WaitlistEntry = {
        id: newId(),
        classGroupId: g.id,
        studentId: input.studentId,
        position,
        status: "waiting",
        createdAt: nowIso(),
      };
      store.waitlist.push(entry);
      return clone({ ...entry, studentName: studentName(input.studentId) });
    });
  },

  // Promove o aluno da espera para matricula (decisao manual; permite exceder a
  // capacidade, pois e uma acao consciente). Curso exige o pagamento escolhido.
  promoteFromWaitlist(id: Id, course?: EnrollmentCourseChoice): Promise<EnrollmentView> {
    return simulateWrite(() => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");
      // Guarda contra clique duplo: so promove quem ainda esta esperando.
      if (w.status !== "waiting") {
        throw apiError("VALIDATION", "Este aluno já saiu da lista de espera.", {
          httpStatus: 409,
        });
      }
      const g = store.classGroups.find((x) => x.id === w.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const student = store.clients.find((c) => c.id === w.studentId);
      if (!student) throw notFoundError("Aluno não encontrado.");
      if (student.status !== "active") {
        throw apiError("VALIDATION", `${student.name} está inativo. Reative o aluno antes de matricular.`, {
          httpStatus: 422,
        });
      }
      const already = activeEnrollments(g.id).some((e) => e.studentId === w.studentId);
      if (already) {
        throw apiError("VALIDATION", `${student.name} já está matriculado nesta turma.`, {
          httpStatus: 409,
        });
      }
      validateStudentScheduleConflict(w.studentId, g.id);
      const choice = resolveCourseChoice(g, course);
      w.status = "promoted";
      renumberWaitlist(g.id);
      const enrollment = createEnrollment(g, student.id, choice);
      return clone(toEnrollmentView(enrollment));
    });
  },

  removeFromWaitlist(id: Id): Promise<void> {
    return simulateWrite(() => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");
      w.status = "canceled";
      renumberWaitlist(w.classGroupId);
    });
  },

  // --- Reservations (Drop-in) ---------------------------------------------
  reserveSession(input: {
    classGroupId: Id;
    sessionId: Id;
    studentId: Id;
    kind?: ReservationKind;
    amountCents?: number;
  }): Promise<ReservationView> {
    return simulateWrite(() => {
      const g = store.classGroups.find((x) => x.id === input.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const already = store.reservations.find(
        (r) =>
          r.sessionId === input.sessionId &&
          r.studentId === input.studentId &&
          r.status === "reserved",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já reservou esta aula." },
        ]);
      }
      const isEnrolled = activeEnrollments(g.id).some(
        (e) => e.studentId === input.studentId,
      );
      if (isEnrolled) {
        throw validationError([
          { field: "studentId", message: "Aluno já está matriculado nesta turma." },
        ]);
      }

      const kind: ReservationKind = input.kind || "dropin";
      // Experimental segue liberada; avulsa so se a turma aceita (ausente = true).
      if (kind === "dropin" && g.allowDropin === false) {
        throw apiError("VALIDATION", "Esta turma não aceita aula avulsa.", {
          httpStatus: 422,
        });
      }
      const p = parseSessionId(input.sessionId);
      const sessionDate = p?.date ?? todayISO();
      const ts = nowIso();

      let chargeId: Id | undefined;
      // Cobranca avulsa apenas para aula paga (kind: "dropin")
      const price = input.amountCents ?? g.sessionPriceCents ?? 0;
      if (kind === "dropin" && price > 0) {
        const charge: Charge = {
          id: newId(),
          organizationId: store.organization.id,
          studentId: input.studentId,
          kind: "dropin",
          unitId: g.unitId,
          classGroupId: g.id,
          sessionId: input.sessionId,
          competence: sessionDate.slice(0, 7),
          dueDate: sessionDate,
          amountCents: price,
          status: "pending",
          createdAt: ts,
          updatedAt: ts,
        };
        store.charges.push(charge);
        chargeId = charge.id;
      }

      const reservation: ClassReservation = {
        id: newId(),
        classGroupId: g.id,
        sessionId: input.sessionId,
        studentId: input.studentId,
        kind,
        chargeId,
        cobrancaId: chargeId,
        status: "reserved",
        reservedAt: ts,
      };
      store.reservations.push(reservation);
      auditLogService.record({
        action: "created",
        target: { type: "enrollment", id: reservation.id, label: `${studentName(input.studentId)} em ${g.name}` },
        predicate: `inscreveu ${studentName(input.studentId)} na aula de ${sessionDate.split("-").reverse().join("/")} da turma ${g.name}${chargeId ? ` (cobrança avulsa de ${formatCents(price)})` : ""}`,
      });

      return clone({
        ...reservation,
        studentName: studentName(input.studentId),
      });
    });
  },

  cancelReservation(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return simulateWrite(() => {
      const r = store.reservations.find(
        (x) =>
          x.sessionId === input.sessionId &&
          x.studentId === input.studentId &&
          x.status === "reserved",
      );
      if (!r) throw notFoundError("Reserva não encontrada.");
      r.status = "canceled";
      // Cancela a cobranca avulsa vinculada (por chargeId ou busca), se ainda nao paga.
      const targetChargeId = r.chargeId || r.cobrancaId;
      const charge = targetChargeId
        ? store.charges.find((c) => c.id === targetChargeId && c.status !== "paid")
        : store.charges.find(
            (c) =>
              c.kind === "dropin" &&
              c.sessionId === input.sessionId &&
              c.studentId === input.studentId &&
              c.status !== "paid",
          );
      if (charge) {
        charge.status = "canceled";
        // Cancelada pelo sistema (aluno saiu da aula), nao por decisao do usuario.
        charge.canceledBy = "system";
        charge.updatedAt = nowIso();
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id: r.id, label: studentName(input.studentId) },
        predicate: `removeu ${studentName(input.studentId)} da aula${charge ? " e cancelou a cobrança avulsa" : ""}`,
      });
    });
  },

  cancelReserva(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return this.cancelReservation(input);
  },
};
