import type {
  ApiErrorField,
  Attendance,
  AttendanceStatus,
  AttendanceSummary,
  AbsenceStreakView,
  Category,
  Charge,
  ClassGroup,
  Client,
  ClassGroupFilter,
  ClassGroupView,
  ClassMeetingSlot,
  ClassReservation,
  ClassSessionDetail,
  ClassSessionOverride,
  ClassSessionView,
  CourseCertificateDocument,
  CreateClassGroup,
  CreateEnrollment,
  DateISO,
  Enrollment,
  EnrollmentCourseChoice,
  EnrollmentCourseInstallments,
  EnrollmentView,
  Id,
  Professional,
  ReservationKind,
  ReservationView,
  SessionRosterEntry,
  SessionRosterKind,
  StudentPackage,
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
  meetingSlotsOn,
  periodsOverlap,
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
import { buildCourseCertificate } from "@gestarahub/core/certificate";
import { store } from "@/mocks/store";
import { withKind } from "@/lib/text";
import { auditLogService } from "./auditLogService";
import { currentCertificateTemplate, syncCertificateTemplateFromDb } from "./certificatesService";
import { assertFeature } from "./subscriptionService";
import { actorTeacherId, assertTeacherSession, teacherSeesClass, teacherSeesSession } from "./teacherScope";
import { cancelOnlinePaymentsForCharge } from "./onlinePaymentsService";
import {
  acceptsPackages,
  hasPackageUsage,
  hasUsablePackage,
  packageCandidatesFor,
  packageRosterInfo,
  syncPackageUsage,
} from "./packagesService";
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
import { isSupabaseOrganization } from "@/lib/session";
import { listProfessionalsFromDb } from "./professionalsBackend";
import { listCategoriesFromDb } from "./categoriesBackend";
import {
  addToWaitlistInDb,
  cancelEnrollmentInDb,
  cancelReservationBySessionStudentInDb,
  createClassGroupInDb,
  createEnrollmentInDb,
  createReservationInDb,
  deleteSessionOverrideInDb,
  listAttendancesFromDb,
  listClassGroupsFromDb,
  listEnrollmentsFromDb,
  listReservationsFromDb,
  listSessionOverridesFromDb,
  listWaitlistFromDb,
  reorderWaitlistInDb,
  setClassGroupStatusInDb,
  updateClassGroupInDb,
  updateEnrollmentInDb,
  updateWaitlistStatusInDb,
  upsertSessionOverrideInDb,
} from "./turmasBackend";
import { insertChargesInDb, updateChargeInDb } from "./billingBackend";
import {
  applyAttendanceWithPackagesInDb,
  listStudentPackagesFromDb,
  upsertMultipleStudentPackagesInDb,
} from "./packagesBackend";

async function syncTurmasFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  try {
    const promises: [
      Promise<ClassGroup[]>,
      Promise<Enrollment[]>,
      Promise<Attendance[]>,
      Promise<WaitlistEntry[]>,
      Promise<ClassReservation[]>,
      Promise<ClassSessionOverride[]>,
      Promise<StudentPackage[]>,
      Promise<Professional[] | null>,
      Promise<Category[] | null>,
    ] = [
      listClassGroupsFromDb(organizationId),
      listEnrollmentsFromDb(organizationId),
      listAttendancesFromDb(organizationId),
      listWaitlistFromDb(organizationId),
      listReservationsFromDb(organizationId),
      listSessionOverridesFromDb(organizationId),
      listStudentPackagesFromDb(organizationId),
      store.professionals.some((p) => p.organizationId === organizationId)
        ? Promise.resolve(null)
        : listProfessionalsFromDb(organizationId),
      store.categories.some((c) => c.organizationId === organizationId)
        ? Promise.resolve(null)
        : listCategoriesFromDb(organizationId),
    ];

    const [groups, enrollments, attendances, waitlist, reservations, overrides, pkgs, profs, cats] =
      await Promise.all(promises);

    const groupIds = new Set(groups.map((g) => g.id));
    store.classGroups = [
      ...store.classGroups.filter((g) => g.organizationId === organizationId ? !groupIds.has(g.id) : true),
      ...groups,
    ];

    const enrollIds = new Set(enrollments.map((e) => e.id));
    store.enrollments = [
      ...store.enrollments.filter((e) => !enrollIds.has(e.id)),
      ...enrollments,
    ];

    const attIds = new Set(attendances.map((a) => a.id));
    store.attendances = [
      ...store.attendances.filter((a) => !attIds.has(a.id)),
      ...attendances,
    ];

    const waitIds = new Set(waitlist.map((w) => w.id));
    store.waitlist = [
      ...store.waitlist.filter((w) => !waitIds.has(w.id)),
      ...waitlist,
    ];

    const resIds = new Set(reservations.map((r) => r.id));
    store.reservations = [
      ...store.reservations.filter((r) => !resIds.has(r.id)),
      ...reservations,
    ];

    store.sessionOverrides = overrides;

    const pkgIds = new Set(pkgs.map((p) => p.id));
    store.studentPackages = [
      ...store.studentPackages.filter((p) => p.organizationId === organizationId ? !pkgIds.has(p.id) : true),
      ...pkgs,
    ];

    if (profs) {
      const profIds = new Set(profs.map((p) => p.id));
      store.professionals = [
        ...store.professionals.filter((p) => p.organizationId === organizationId ? !profIds.has(p.id) : true),
        ...profs,
      ];
    }

    if (cats) {
      const catIds = new Set(cats.map((c) => c.id));
      store.categories = [
        ...store.categories.filter((c) => c.organizationId === organizationId ? !catIds.has(c.id) : true),
        ...cats,
      ];
    }
  } catch (err) {
    console.error("[turmasService] Erro ao sincronizar dados do Supabase:", err);
  }
}

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
function resolveSession(id: Id): { g: ClassGroup; date: DateISO; slot: ClassMeetingSlot } {
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
    payload.startDate ? upcomingPeriod(payload.startDate, payload.endDate) : undefined,
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

/** Periodo que ainda vai acontecer: de hoje (ou do inicio, se for depois) ao fim. */
function upcomingPeriod(startDate: DateISO, endDate?: DateISO) {
  const today = todayISO();
  return { startDate: startDate > today ? startDate : today, endDate };
}

// Valida se o aluno já está em outra turma com horário conflitante (mesmo dia/hora).
// So conta turma com dias em comum daqui para frente (curso concluido nao bloqueia).
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
      if (
        !periodsOverlap(upcomingPeriod(targetGroup.startDate, targetGroup.endDate), {
          startDate: otherGroup.startDate,
          endDate: otherGroup.endDate,
        })
      ) {
        continue;
      }

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
async function createEnrollment(
  g: ClassGroup,
  studentId: Id,
  course?: EnrollmentCourseChoice,
  paysWithPackage?: boolean,
): Promise<Enrollment> {
  const ts = nowIso();
  const enrollment: Enrollment = {
    id: newId(),
    classGroupId: g.id,
    studentId,
    status: "active",
    enrolledAt: ts,
    ...(paysWithPackage ? { paysWithPackage: true } : {}),
  };
  const name = studentName(studentId);
  if (course) {
    const installmentGroupId = newId();
    enrollment.course = { ...course, installmentGroupId };
    const parts = splitInstallments(course.priceCents, course.installments, course.firstDueDate);
    const courseCharges = parts.map(
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
    );
    store.charges.push(...courseCharges);
    if (isSupabaseOrganization(store.organization.id)) {
      await insertChargesInDb(courseCharges);
    }
  }
  if (isSupabaseOrganization(store.organization.id)) {
    await createEnrollmentInDb(enrollment, store.organization.id);
  }
  store.enrollments.push(enrollment);
  auditLogService.record({
    action: "created",
    target: { type: "enrollment", id: enrollment.id, label: `${name} em ${g.name}` },
    predicate: course
      ? `matriculou ${name} no ${withKind("curso", g.name)} (${formatCents(course.priceCents)}${course.installments > 1 ? `, em ${course.installments} parcelas` : ""})`
      : `matriculou ${name} na turma ${g.name}${paysWithPackage ? " (paga com pacote)" : ""}`,
  });
  return enrollment;
}

/**
 * Pagar com pacote na turma de mensalidade (doc 20): so nela, e o aluno
 * precisa ter pacote com aulas para a modalidade hoje. Nas demais formas a
 * turma ja decide (pacote gasta sempre; curso e sem cobranca nunca).
 */
function resolvePaysWithPackage(g: ClassGroup, studentId: Id, paysWithPackage?: boolean): boolean {
  if (!paysWithPackage || classBillingMode(g) !== "membership") return false;
  if (!hasUsablePackage(studentId, g, todayISO())) {
    throw validationError([
      {
        field: "paysWithPackage",
        message: `${studentName(studentId)} não tem pacote com aulas para esta turma.`,
      },
    ]);
  }
  return true;
}

/**
 * Padrao sem escolha explicita (promover da lista de espera): na turma de
 * mensalidade, quem nao tem plano e tem pacote valido paga com o pacote.
 */
function defaultPaysWithPackage(g: ClassGroup, student: Client): boolean {
  return (
    classBillingMode(g) === "membership" &&
    !student.planId &&
    hasUsablePackage(student.id, g, todayISO())
  );
}

/** Matricula do aluno na turma: a ativa ou, sem ela, a ultima (presenca antiga). */
function enrollmentOf(classGroupId: Id, studentId: Id): Enrollment | undefined {
  const rows = store.enrollments.filter((e) => e.classGroupId === classGroupId && e.studentId === studentId);
  return rows.find((e) => e.status === "active") ?? rows[rows.length - 1];
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

/** Mesma grade (ordem nao importa). */
function sameSlots(a: ClassMeetingSlot[], b: ClassMeetingSlot[]): boolean {
  const key = (slots: ClassMeetingSlot[]) =>
    slots
      .map((s) => `${s.weekday}|${s.start}|${s.end}`)
      .sort()
      .join(",");
  return key(a) === key(b);
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
function paysWithPackage(g: ClassGroup, kind: SessionRosterKind | undefined, studentId: Id): boolean {
  // Turma sem cobranca e curso nunca gastam pacote.
  if (kind === "package") return acceptsPackages(g);
  if (kind !== "enrolled") return false;
  const mode = classBillingMode(g);
  if (mode === "package") return true;
  return mode === "membership" && Boolean(enrollmentOf(g.id, studentId)?.paysWithPackage);
}

/**
 * Acerta o pacote do aluno com a chamada desta aula (gasta, troca o motivo ou
 * devolve). `status` ausente = presenca desmarcada.
 */
function syncAttendanceUsage(sessionId: Id, studentId: Id, status?: AttendanceStatus) {
  const p = parseSessionId(sessionId);
  const g = p ? store.classGroups.find((x) => x.id === p.classGroupId) : undefined;
  if (!p || !g) return "none" as const;
  const kind = buildRoster(g, sessionId, p.date).find((r) => r.studentId === studentId)?.kind;
  // Aula que ja gastou pacote segue no pacote mesmo depois de o aluno passar
  // a pagar com mensalidade (remarcar nao devolve a aula; desmarcar devolve).
  const byPackage = paysWithPackage(g, kind, studentId) || hasPackageUsage(studentId, sessionId);
  return syncPackageUsage({
    studentId,
    sessionId,
    classGroupId: g.id,
    modalityId: g.modalityId,
    date: p.date,
    status: byPackage ? status : undefined,
  });
}

const ATTENDANCE_WORD: Record<AttendanceStatus, string> = {
  present: "presença",
  absent: "falta",
  justified: "falta justificada",
};

/**
 * Chamada so entra na Auditoria quando mexe no pacote (gasta ou devolve
 * aula): marcar presenca o dia todo encheria o registro.
 */
function auditPackageUsage(
  usage: ReturnType<typeof syncAttendanceUsage>,
  g: ClassGroup,
  date: DateISO,
  studentId: Id,
  status?: AttendanceStatus,
) {
  if (usage !== "added" && usage !== "reverted") return;
  const name = studentName(studentId);
  const mark = status ? ATTENDANCE_WORD[status] : "chamada desfeita";
  const when = `${mark} em ${g.name}, ${format(parseISO(date), "dd/MM")}`;
  auditLogService.record({
    action: "updated",
    target: { type: "client", id: studentId, label: name },
    predicate:
      usage === "added"
        ? `descontou 1 aula do pacote de ${name} (${when})`
        : `devolveu 1 aula ao pacote de ${name} (${when})`,
  });
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

function buildSessionDetail(id: Id): ClassSessionDetail {
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

// Renumera a fila (1..n) de quem ainda espera, na ordem atual.
async function renumberWaitlist(classGroupId: Id): Promise<void> {
  const waiting = store.waitlist
    .filter((w) => w.classGroupId === classGroupId && w.status === "waiting")
    .sort((a, b) => a.position - b.position);

  waiting.forEach((w, i) => {
    w.position = i + 1;
  });

  if (isSupabaseOrganization(store.organization.id)) {
    await reorderWaitlistInDb(classGroupId, waiting.map((w) => w.id), store.organization.id);
  }
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
    for (const slot of meetingSlotsOn(g, date)) {
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
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
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
      // Professor: so as turmas em que e o titular.
      const teacherId = actorTeacherId();
      if (teacherId !== undefined) result = result.filter((g) => teacherSeesClass(g, teacherId));
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toGroupView),
      );
    });
  },

  getById(id: Id): Promise<ClassGroupView> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      const g = store.classGroups.find((x) => x.id === id);
      if (!g || !teacherSeesClass(g)) throw notFoundError("Turma não encontrada.");
      return clone(toGroupView(g));
    });
  },

  create(input: CreateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await createClassGroupInDb(g);
      }

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
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      // Mudar a forma ou o valor nao mexe nas parcelas das matriculas ja feitas.
      const current = store.classGroups[idx];
      const next = normalizeBilling({ ...current, ...payload });
      validateGroup(next, id);
      // Novo horario vale daqui para frente: a grade antiga fica para as aulas
      // passadas (e para as de hoje, se a chamada de hoje ja foi feita).
      if (payload.meetingSlots && !sameSlots(current.meetingSlots, payload.meetingSlots)) {
        const today = todayISO();
        const todayHasRecords = store.attendances.some((a) =>
          a.sessionId.startsWith(`${id}${SEP}${today}${SEP}`),
        );
        const until = todayHasRecords ? today : format(addDays(parseISO(today), -1), "yyyy-MM-dd");
        const history = current.scheduleHistory ?? [];
        if (current.startDate <= until && !history.some((v) => v.until >= until)) {
          next.scheduleHistory = [...history, { until, meetingSlots: current.meetingSlots }];
        }
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await updateClassGroupInDb(id, payload, store.organization.id, {
          scheduleHistory: next.scheduleHistory,
        });
      }

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
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      if (g.status === "inactive") {
        throw validationError([
          { field: "status", message: "Turma já foi desativada." },
        ]);
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await setClassGroupStatusInDb(id, "inactive", store.organization.id);
      }

      store.classGroups[idx] = {
        ...g,
        status: "inactive",
        updatedAt: nowIso(),
      };
      // Sem aulas daqui para frente: reservas futuras saem, e a avulsa em aberto
      // delas tambem (cancelada pelo sistema, nao e perda).
      const today = todayISO();
      let canceledReservations = 0;
      for (const r of store.reservations) {
        const date = parseSessionId(r.sessionId)?.date;
        if (r.status !== "reserved" || !r.sessionId.startsWith(`${id}${SEP}`) || !date || date <= today) continue;
        r.status = "canceled";
        canceledReservations += 1;
        const chargeId = r.chargeId || r.cobrancaId;
        const charge = chargeId ? store.charges.find((c) => c.id === chargeId) : undefined;
        if (charge && (charge.status === "pending" || charge.status === "overdue")) {
          charge.status = "canceled";
          charge.canceledBy = "system";
          charge.notes = "Turma desativada";
          charge.updatedAt = nowIso();
          cancelOnlinePaymentsForCharge(charge.id);
        }
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "class_group", id, label: g.name },
        predicate: `desativou a turma ${g.name}${canceledReservations > 0 ? ` e cancelou ${plural(canceledReservations, "reserva futura", "reservas futuras")}` : ""}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // Reativa uma turma desativada.
  reactivate(id: Id): Promise<ClassGroupView> {
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      // Enquanto inativa, o horario pode ter sido ocupado por outra turma do instrutor.
      const [conflict] = findInstructorConflicts(
        g.meetingSlots,
        g.instructorId,
        store.classGroups,
        g.id,
        upcomingPeriod(g.startDate, g.endDate),
      );
      if (conflict) {
        throw apiError(
          "CLASS_SCHEDULE_CONFLICT",
          instructorConflictMessage(instructorName(g.instructorId) || "O instrutor", conflict),
          { httpStatus: 409 },
        );
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await setClassGroupStatusInDb(id, "active", store.organization.id);
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
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
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

  /**
   * Certificado de conclusao (doc 20, fase D; recurso pago `certificates`).
   * So para matricula ativa em curso ja terminado ("Concluído"). Devolve os
   * dados do aluno e o modelo do espaco (doc 21, secao 1).
   */
  getCourseCertificate(enrollmentId: Id): Promise<CourseCertificateDocument> {
    return simulateRead(async () => {
      assertFeature("certificates");
      await syncCertificateTemplateFromDb();
      const e = store.enrollments.find((x) => x.id === enrollmentId);
      if (!e || e.status === "canceled") throw notFoundError("Matrícula não encontrada.");
      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      if (!isCourseEnded(g, todayISO()) || !g.endDate) {
        throw apiError("VALIDATION", "O certificado sai quando o curso termina.", { httpStatus: 422 });
      }
      const address = store.unit.address;
      const { presentCount, absentCount } = frequencyOf(g.id, e.studentId);
      const certificate = buildCourseCertificate({
        enrollmentId: e.id,
        classGroupId: g.id,
        organizationName: store.organization.name,
        studentName: studentName(e.studentId),
        courseName: g.name,
        modalityName: modalityName(g.modalityId),
        startDate: g.startDate,
        endDate: g.endDate,
        meetingSlots: g.meetingSlots,
        presentCount,
        absentCount,
        instructorName: instructorName(g.instructorId),
        city: typeof address === "object" ? address?.city : undefined,
        issuedOn: todayISO(),
      });
      return clone({ certificate, template: currentCertificateTemplate() });
    });
  },

  // Capacidade e regra MOLE: com a turma lotada, lanca CLASS_FULL; o form pede
  // confirmacao e reenvia com `allowOverCapacity`. Curso exige `payload.course`
  // e gera as parcelas na hora (doc 20, fase B).
  enroll(
    payload: CreateEnrollment,
    opts: { allowOverCapacity?: boolean } = {},
  ): Promise<EnrollmentView> {
    return simulateWrite(async () => {
      const g = store.classGroups.find((x) => x.id === payload.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      if (g.status !== "active") {
        throw apiError("VALIDATION", "Turma desativada. Reative para matricular.", { httpStatus: 409 });
      }
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
      const withPackage = resolvePaysWithPackage(g, student.id, payload.paysWithPackage);
      if (!opts.allowOverCapacity && activeEnrollments(g.id).length >= g.capacity) {
        throw apiError("CLASS_FULL", `Turma lotada (${g.capacity} vagas).`, {
          httpStatus: 409,
        });
      }
      // Rematricula no curso: as parcelas em aberto das matriculas anteriores
      // saem quando o usuario escolhe (senao seguem como divida).
      let canceledPrevious = 0;
      if (course && payload.cancelOpenCourseCharges) {
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "course" || c.studentId !== student.id || c.classGroupId !== g.id) continue;
          if (c.status !== "pending" && c.status !== "overdue") continue;
          c.status = "canceled";
          c.canceledBy = "user";
          c.cancelReason = "Rematrícula no curso";
          c.updatedAt = ts;
          cancelOnlinePaymentsForCharge(c.id);
          canceledPrevious += 1;
        }
      }
      const enrollment = await createEnrollment(g, student.id, course, withPackage);
      if (canceledPrevious > 0) {
        auditLogService.record({
          action: "cancelled",
          target: { type: "enrollment", id: enrollment.id, label: `${student.name} em ${g.name}` },
          predicate: `cancelou ${plural(canceledPrevious, "parcela em aberto", "parcelas em aberto")} da matrícula anterior de ${student.name} no curso ${g.name}`,
        });
      }
      return clone(toEnrollmentView(enrollment));
    });
  },

  /**
   * Troca como o aluno paga a turma de mensalidade: com pacote (cada presenca
   * daqui em diante gasta uma aula) ou pela mensalidade. Aulas ja gastas ficam.
   */
  setEnrollmentPayment(id: Id, paysWithPackage: boolean): Promise<EnrollmentView> {
    return simulateWrite(async () => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e || e.status === "canceled") throw notFoundError("Matrícula não encontrada.");
      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      if (classBillingMode(g) !== "membership") {
        throw apiError("VALIDATION", "Só a turma de mensalidade permite escolher como o aluno paga.", {
          httpStatus: 422,
        });
      }
      if (Boolean(e.paysWithPackage) === paysWithPackage) return clone(toEnrollmentView(e));
      if (paysWithPackage) {
        resolvePaysWithPackage(g, e.studentId, true);
        e.paysWithPackage = true;
      } else {
        delete e.paysWithPackage;
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await updateEnrollmentInDb(id, { paysWithPackage: Boolean(e.paysWithPackage) }, store.organization.id);
      }

      const name = studentName(e.studentId);
      auditLogService.record({
        action: "updated",
        target: { type: "enrollment", id: e.id, label: `${name} em ${g.name}` },
        predicate: paysWithPackage
          ? `passou ${name} a pagar a turma ${g.name} com pacote`
          : `passou ${name} a pagar a turma ${g.name} com mensalidade`,
      });
      return clone(toEnrollmentView(e));
    });
  },

  cancelEnrollment(id: Id, reason?: string): Promise<void> {
    return simulateWrite(async () => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e) throw notFoundError("Matrícula não encontrada.");
      if (e.status === "canceled") {
        throw apiError("VALIDATION", "Esta matrícula já foi cancelada.", { httpStatus: 409 });
      }
      e.status = "canceled";
      e.canceledAt = nowIso();
      e.cancellationReason = reason?.trim() || undefined;

      if (isSupabaseOrganization(store.organization.id)) {
        await cancelEnrollmentInDb(id, e.cancellationReason, e.canceledAt, store.organization.id);
      }

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
          ? `cancelou a matrícula de ${studentName(e.studentId)} no ${withKind("curso", turma)}${canceledInstallments > 0 ? ` e ${plural(canceledInstallments, "parcela futura", "parcelas futuras")}` : ""}`
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
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      const groups = store.classGroups.filter(
        (g) =>
          g.status === "active" &&
          (!filter.classGroupId || g.id === filter.classGroupId),
      );
      const out: ClassSessionListItem[] = [];
      // Professor: aulas das turmas dele e as que ele substitui.
      const teacherId = actorTeacherId();
      for (const date of datesBetween(filter.dateFrom, filter.dateTo)) {
        const wd = weekdayOf(date);
        for (const g of groups) {
          if (date < g.startDate) continue;
          if (g.endDate && date > g.endDate) continue;
          for (const slot of meetingSlotsOn(g, date)) {
            if (slot.weekday !== wd) continue;
            if (!teacherSeesSession(g, makeSessionId(g.id, date, slot.start), teacherId)) continue;
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
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      const { g } = resolveSession(id);
      if (!teacherSeesSession(g, id)) throw notFoundError("Aula não encontrada.");
      return clone(buildSessionDetail(id));
    });
  },

  markAttendance(input: {
    sessionId: Id;
    studentId: Id;
    status: AttendanceStatus;
  }): Promise<void> {
    return simulateWrite(async () => {
      const { g, date } = resolveSession(input.sessionId);
      assertTeacherSession(g, input.sessionId);
      if (date > todayISO()) {
        throw apiError("VALIDATION", "A chamada só pode ser feita no dia da aula ou depois.", {
          httpStatus: 422,
        });
      }
      const existing = store.attendances.find(
        (a) => a.sessionId === input.sessionId && a.studentId === input.studentId,
      );
      let attendanceRecord: Attendance;
      if (existing) {
        existing.status = input.status;
        existing.markedAt = nowIso();
        attendanceRecord = existing;
      } else {
        attendanceRecord = {
          id: newId(),
          sessionId: input.sessionId,
          studentId: input.studentId,
          status: input.status,
          markedAt: nowIso(),
        };
        store.attendances.push(attendanceRecord);
      }

      // Pacote de aulas: presenca gasta, falta conforme o pacote, justificada nao.
      const usage = syncAttendanceUsage(input.sessionId, input.studentId, input.status);
      // Presenca e gasto do pacote na mesma transacao (nunca um sem o outro).
      if (isSupabaseOrganization(store.organization.id)) {
        await applyAttendanceWithPackagesInDb({
          organizationId: store.organization.id,
          sessionId: input.sessionId,
          studentId: input.studentId,
          attendance: attendanceRecord,
          packages:
            usage === "none" ? [] : store.studentPackages.filter((p) => p.studentId === input.studentId),
        });
      }
      auditPackageUsage(usage, g, date, input.studentId, input.status);
    });
  },

  /** Desmarca a presenca (volta a "a marcar") e devolve a aula do pacote, se gastou. */
  clearAttendance(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return simulateWrite(async () => {
      const { g, date } = resolveSession(input.sessionId);
      assertTeacherSession(g, input.sessionId);

      store.attendances = store.attendances.filter(
        (a) => !(a.sessionId === input.sessionId && a.studentId === input.studentId),
      );
      const usage = syncAttendanceUsage(input.sessionId, input.studentId);
      // Apaga a presenca e devolve a aula do pacote na mesma transacao.
      if (isSupabaseOrganization(store.organization.id)) {
        await applyAttendanceWithPackagesInDb({
          organizationId: store.organization.id,
          sessionId: input.sessionId,
          studentId: input.studentId,
          attendance: null,
          packages:
            usage === "none" ? [] : store.studentPackages.filter((p) => p.studentId === input.studentId),
        });
      }
      auditPackageUsage(usage, g, date, input.studentId);
    });
  },

  getAttendanceSummary(date: DateISO): Promise<AttendanceSummary> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
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
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
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
    return simulateWrite(async () => {
      const { g, date, slot } = resolveSession(sessionId);

      const instructor = store.professionals.find((x) => x.id === payload.instructorId);
      if (!instructor) throw notFoundError("Instrutor não encontrado.");
      validateSubstituteConflict(sessionId, date, slot, instructor.id, instructor.name);

      if (!store.sessionOverrides) {
        store.sessionOverrides = [];
      }

      const existingIndex = store.sessionOverrides.findIndex(
        (o) => o.sessionId === sessionId,
      );
      const ts = nowIso();

      const overrideRecord: ClassSessionOverride = {
        sessionId,
        instructorId: payload.instructorId,
        reason: payload.reason?.trim() || undefined,
        createdAt: existingIndex !== -1 ? store.sessionOverrides[existingIndex].createdAt : ts,
        updatedAt: ts,
      };

      if (isSupabaseOrganization(store.organization.id)) {
        await upsertSessionOverrideInDb(overrideRecord, store.organization.id);
      }

      if (existingIndex !== -1) {
        store.sessionOverrides[existingIndex] = overrideRecord;
      } else {
        store.sessionOverrides.push(overrideRecord);
      }
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id: g.id, label: g.name },
        predicate: `colocou ${instructor.name} no lugar de ${instructorName(g.instructorId) || "o instrutor"} na aula de ${format(parseISO(date), "dd/MM")} da turma ${g.name}`,
      });

      return clone(buildSessionDetail(sessionId));
    });
  },

  restorePrimaryInstructor(sessionId: Id): Promise<ClassSessionDetail> {
    return simulateWrite(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        await deleteSessionOverrideInDb(sessionId, store.organization.id);
      }

      if (store.sessionOverrides) {
        const idx = store.sessionOverrides.findIndex(
          (o) => o.sessionId === sessionId,
        );
        if (idx !== -1) {
          store.sessionOverrides.splice(idx, 1);
          const { g, date } = resolveSession(sessionId);
          auditLogService.record({
            action: "updated",
            target: { type: "class_group", id: g.id, label: g.name },
            predicate: `voltou ${instructorName(g.instructorId) || "o instrutor"} para a aula de ${format(parseISO(date), "dd/MM")} da turma ${g.name}`,
          });
        }
      }
      return clone(buildSessionDetail(sessionId));
    });
  },

  // --- Lista de espera ----------------------------------------------------
  listWaitlist(classGroupId: Id): Promise<WaitlistEntryView[]> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
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
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await addToWaitlistInDb(entry, store.organization.id);
      }

      store.waitlist.push(entry);
      return clone({ ...entry, studentName: studentName(input.studentId) });
    });
  },

  // Promove o aluno da espera para matricula (decisao manual; permite exceder a
  // capacidade, pois e uma acao consciente). Curso exige o pagamento escolhido.
  promoteFromWaitlist(id: Id, course?: EnrollmentCourseChoice): Promise<EnrollmentView> {
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await updateWaitlistStatusInDb(id, "promoted", store.organization.id);
      }

      w.status = "promoted";
      await renumberWaitlist(g.id);
      const enrollment = await createEnrollment(g, student.id, choice, defaultPaysWithPackage(g, student));
      return clone(toEnrollmentView(enrollment));
    });
  },

  removeFromWaitlist(id: Id): Promise<void> {
    return simulateWrite(async () => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");

      if (isSupabaseOrganization(store.organization.id)) {
        await updateWaitlistStatusInDb(id, "canceled", store.organization.id);
      }

      w.status = "canceled";
      await renumberWaitlist(w.classGroupId);
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
    return simulateWrite(async () => {
      const { g } = resolveSession(input.sessionId);
      if (g.id !== input.classGroupId) throw notFoundError("Aula não encontrada.");
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
      // Pacote: entra em qualquer aula das modalidades dele, sem cobranca.
      if (kind === "package" && !acceptsPackages(g)) {
        throw apiError("VALIDATION", "Esta turma não aceita pacote.", { httpStatus: 422 });
      }
      if (kind === "package" && !hasUsablePackage(input.studentId, g, sessionDate)) {
        throw apiError(
          "VALIDATION",
          `${studentName(input.studentId)} não tem pacote com aulas para esta turma.`,
          { httpStatus: 422 },
        );
      }
      const ts = nowIso();

      let chargeId: Id | undefined;
      // Cobranca avulsa apenas para aula paga (kind: "dropin"). Se o aluno tinha
      // saido desta mesma aula sem pagar, reaproveita a cobranca encerrada pelo
      // sistema para nao duplicar linha no historico.
      const price = input.amountCents ?? g.sessionPriceCents ?? 0;
      if (kind === "dropin" && price > 0) {
        const existingCanceled = store.charges.find(
          (c) =>
            c.kind === "dropin" &&
            c.sessionId === input.sessionId &&
            c.studentId === input.studentId &&
            c.status === "canceled" &&
            c.canceledBy === "system",
        );
        if (existingCanceled) {
          existingCanceled.competence = sessionDate.slice(0, 7);
          existingCanceled.dueDate = sessionDate;
          existingCanceled.amountCents = price;
          existingCanceled.status = "pending";
          existingCanceled.canceledBy = undefined;
          existingCanceled.cancelReason = undefined;
          existingCanceled.replaced = undefined;
          existingCanceled.notes = undefined;
          existingCanceled.updatedAt = ts;
          chargeId = existingCanceled.id;
        } else {
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
          if (isSupabaseOrganization(store.organization.id)) {
            await insertChargesInDb([charge]);
          }
        }
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

      if (isSupabaseOrganization(store.organization.id)) {
        await createReservationInDb(reservation, store.organization.id);
      }

      store.reservations.push(reservation);
      auditLogService.record({
        action: "created",
        target: { type: "enrollment", id: reservation.id, label: `${studentName(input.studentId)} em ${g.name}` },
        predicate: `inscreveu ${studentName(input.studentId)} na aula de ${sessionDate.split("-").reverse().join("/")} da turma ${g.name}${chargeId ? ` (cobrança avulsa de ${formatCents(price)})` : kind === "package" ? " (usa 1 aula do pacote)" : ""}`,
      });

      return clone({
        ...reservation,
        studentName: studentName(input.studentId),
      });
    });
  },

  cancelReservation(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return simulateWrite(async () => {
      const r = store.reservations.find(
        (x) =>
          x.sessionId === input.sessionId &&
          x.studentId === input.studentId &&
          x.status === "reserved",
      );
      if (!r) throw notFoundError("Reserva não encontrada.");
      // Quem entrou pelo pacote devolve a aula, se ja tinha gastado.
      const returned = r.kind === "package" && syncAttendanceUsage(input.sessionId, input.studentId) === "reverted";
      // A presenca sai junto: voltar para a aula comeca sem marcacao (e gasta de novo).
      store.attendances = store.attendances.filter(
        (a) => !(a.sessionId === input.sessionId && a.studentId === input.studentId),
      );

      if (isSupabaseOrganization(store.organization.id)) {
        await cancelReservationBySessionStudentInDb(input.sessionId, input.studentId, store.organization.id);
      }

      r.status = "canceled";
      // Cancela a cobranca avulsa vinculada (por chargeId ou busca), se ainda nao paga.
      const targetChargeId = r.chargeId || r.cobrancaId;
      const charge = r.kind === "package"
        ? undefined
        : targetChargeId
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
        charge.notes = "Saiu da aula";
        charge.updatedAt = nowIso();
        if (isSupabaseOrganization(store.organization.id)) {
          await updateChargeInDb(charge.id, {
            status: "canceled",
            canceledBy: "system",
            notes: charge.notes,
          }, store.organization.id);
        }
      }
      if (returned && isSupabaseOrganization(store.organization.id)) {
        const pkgs = store.studentPackages.filter((p) => p.studentId === input.studentId);
        if (pkgs.length > 0) {
          await upsertMultipleStudentPackagesInDb(pkgs);
        }
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id: r.id, label: studentName(input.studentId) },
        predicate: `removeu ${studentName(input.studentId)} da aula${charge ? " e cancelou a cobrança avulsa" : returned ? " e devolveu a aula do pacote" : ""}`,
      });
    });
  },

  cancelReserva(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return this.cancelReservation(input);
  },
};
