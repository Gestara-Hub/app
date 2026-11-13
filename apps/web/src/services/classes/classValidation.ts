import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/services/world/actor";
import { isIsoDate } from "@gestarahub/core/date";
import type {
  ApiErrorField,
  ClassGroup,
  ClassMeetingSlot,
  CreateClassGroup,
  DateISO,
  EnrollmentCourseChoice,
  Id,
  TimeISO,
} from "@gestarahub/contracts";
import { teamWords } from "@/services/world/nouns";
import { classBillingMode, isCourseEnded, MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import {
  checkSlotWithinBusinessHours,
  findInstructorConflicts,
  instructorConflictMessage,
  meetingSlotsOn,
  periodsOverlap,
  weekdayOf,
} from "@gestarahub/core/scheduling";
import { apiError, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { todayISO, brDate, makeSessionId, upcomingPeriod } from "./classShared";

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
      message: instructorConflictMessage(instructor?.name ?? `O ${teamWords().lower}`, conflict, teamWords().lower),
    },
  ];
  throw validationError(fields);
}

// Valida se o aluno já está em outra turma com horário conflitante (mesmo dia/hora).
// So conta turma com dias em comum daqui para frente (curso concluido nao bloqueia).
export function validateStudentScheduleConflict(
  studentId: Id,
  targetClassGroupId: Id,
  /** Turma que o aluno esta deixando (mudar de turma): nao conta como choque. */
  leavingClassGroupId?: Id,
): void {
  const targetGroup = store.classGroups.find((g) => g.id === targetClassGroupId);
  if (!targetGroup || targetGroup.status !== "active") return;

  const student = store.clients.find((c) => c.id === studentId);
  const studentName = student?.name ?? "Aluno";

  const otherActiveEnrollments = store.enrollments.filter(
    (e) =>
      e.studentId === studentId &&
      e.status === "active" &&
      e.classGroupId !== targetClassGroupId &&
      e.classGroupId !== leavingClassGroupId,
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


const isValidDate = isIsoDate;

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
export function normalizeBilling<T extends Partial<CreateClassGroup>>(payload: T): T {
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
export function resolveCourseChoice(g: ClassGroup, choice?: EnrollmentCourseChoice): EnrollmentCourseChoice | undefined {
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
  // Preco do curso diferente do da turma so com a permissao de cobrancas; quem
  // matricula sem ela fica com o da turma (achado V10 de 31/10/2026).
  const actor = getCurrentActor();
  const mayAdjust = !actor || can(actor.profile, "billing:manage");
  const priceCents = mayAdjust || !g.coursePriceCents ? choice.priceCents : g.coursePriceCents;
  return { priceCents, installments: choice.installments, firstDueDate: choice.firstDueDate };
}

export function validateGroup(payload: Partial<CreateClassGroup>, currentGroupId?: Id): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome da turma." });
  }
  if (!payload.modalityId) {
    fields.push({ field: "modalityId", message: "Selecione a modalidade da turma." });
  }
  if (!payload.instructorId) {
    fields.push({ field: "instructorId", message: `Selecione o ${teamWords().lower}.` });
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
export function sameSlots(a: ClassMeetingSlot[], b: ClassMeetingSlot[]): boolean {
  const key = (slots: ClassMeetingSlot[]) =>
    slots
      .map((s) => `${s.weekday}|${s.start}|${s.end}`)
      .sort()
      .join(",");
  return key(a) === key(b);
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
export function validateSubstituteConflict(
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
    throw apiError("CLASS_SCHEDULE_CONFLICT", instructorConflictMessage(name, conflict, teamWords().lower), {
      httpStatus: 409,
    });
  }
}
