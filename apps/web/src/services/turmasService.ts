import type {
  ApiErrorField,
  AttendanceStatus,
  AttendanceSummary,
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
import { checkSlotWithinBusinessHours, weekdayOf } from "@gestarahub/core/scheduling";
import { formatCents } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
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
      e.enrolledAt.slice(0, 10) <= date &&
      (e.status === "active" || (e.canceledAt !== undefined && e.canceledAt.slice(0, 10) > date)),
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
    status: date < todayISO() ? "done" : "scheduled",
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

// Valida conflito de horário: instrutor não pode estar em duas turmas no mesmo dia/hora.
function validateInstructorScheduleConflict(
  payload: Partial<CreateClassGroup>,
  currentGroupId?: Id,
): void {
  const fields: ApiErrorField[] = [];
  if (!payload.instructorId || !payload.meetingSlots) return;

  const instructor = store.professionals.find((p) => p.id === payload.instructorId);
  const instructorName = instructor?.name ?? "Instrutor";

  for (const slot of payload.meetingSlots) {
    // Procura outras turmas ATIVAS do mesmo instrutor no mesmo dia.
    const conflicts = store.classGroups.filter(
      (g) =>
        g.id !== currentGroupId && // Não compara com ela mesma (ao editar).
        g.status === "active" &&
        g.instructorId === payload.instructorId &&
        g.meetingSlots.some((s) => {
          if (s.weekday !== slot.weekday) return false; // Dia diferente.
          // Mesmo dia: verifica sobreposição de horário.
          return timesOverlap(slot.start, slot.end, s.start, s.end);
        }),
    );

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      const conflictSlot = conflict.meetingSlots.find(
        (s) =>
          s.weekday === slot.weekday &&
          timesOverlap(slot.start, slot.end, s.start, s.end),
      );
      if (conflictSlot) {
        const dayName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
          slot.weekday
        ];
        fields.push({
          field: "meetingSlots",
          message: `${instructorName} já tem aula ${dayName} ${conflictSlot.start}-${conflictSlot.end} em "${conflict.name}".`,
        });
        break; // Mostra só o primeiro conflito.
      }
    }
  }

  if (fields.length > 0) throw validationError(fields);
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
  if (fields.length > 0) throw validationError(fields);

  // Valida se os encontros estão dentro do expediente da unidade.
  validateMeetingSlotsBusinessHours(payload.meetingSlots);

  // Valida conflito de horário do instrutor (executado após validações básicas).
  validateInstructorScheduleConflict(payload, currentGroupId);
}

function buildSessionDetail(id: Id): ClassSessionDetail {
  const p = parseSessionId(id);
  const g = p
    ? store.classGroups.find((x) => x.id === p.classGroupId)
    : undefined;
  if (!p || !g) throw notFoundError("Aula não encontrada.");
  const slot = g.meetingSlots.find((s) => s.start === p.start);
  if (!slot) throw notFoundError("Aula não encontrada.");
  const view = toSessionView(g, p.date, slot);

  // Roster unificado (híbrido):
  // 1. Alunos matriculados da turma
  // Quem tem presenca registrada nesta aula continua na lista, mesmo que a
  // matricula tenha mudado depois.
  const marked = new Set(
    store.attendances.filter((a) => a.sessionId === id).map((a) => a.studentId),
  );
  const onDate = enrollmentsOn(g.id, p.date);
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

  const roster: SessionRosterEntry[] = [
    ...enrolledEntries,
    ...reservedEntries,
  ].sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));

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

  create(payload: CreateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(() => {
      validateGroup(payload, undefined);
      const ts = nowIso();
      const g: ClassGroup = { ...payload, id: newId(), createdAt: ts, updatedAt: ts };
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
      validateGroup({ ...store.classGroups[idx], ...payload }, id);
      store.classGroups[idx] = {
        ...store.classGroups[idx],
        ...payload,
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
          .map((e) => ({
            ...e,
            studentName: studentName(e.studentId),
            studentStatus:
              store.clients.find((c) => c.id === e.studentId)?.status ??
              "inactive",
            ...frequencyOf(classGroupId, e.studentId),
          }))
          .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  // Capacidade e regra MOLE: com a turma lotada, lanca CLASS_FULL; o form pede
  // confirmacao e reenvia com `allowOverCapacity`.
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
      if (!opts.allowOverCapacity && activeEnrollments(g.id).length >= g.capacity) {
        throw apiError("CLASS_FULL", `Turma lotada (${g.capacity} vagas).`, {
          httpStatus: 409,
        });
      }
      const enrollment: Enrollment = {
        id: newId(),
        classGroupId: g.id,
        studentId: payload.studentId,
        status: "active",
        enrolledAt: nowIso(),
      };
      store.enrollments.push(enrollment);
      auditLogService.record({
        action: "created",
        target: { type: "enrollment", id: enrollment.id, label: `${student.name} em ${g.name}` },
        predicate: `matriculou ${student.name} na turma ${g.name}`,
      });
      return clone({
        ...enrollment,
        studentName: student.name,
        studentStatus: student.status,
        presentCount: 0,
        absentCount: 0,
        attendanceRate: null,
      });
    });
  },

  cancelEnrollment(id: Id, reason?: string): Promise<void> {
    return simulateWrite(() => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e) throw notFoundError("Matrícula não encontrada.");
      e.status = "canceled";
      e.canceledAt = nowIso();
      e.cancellationReason = reason?.trim() || undefined;
      const turma = store.classGroups.find((g) => g.id === e.classGroupId)?.name ?? "";
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id, label: `${studentName(e.studentId)} em ${turma}` },
        predicate: `cancelou a matrícula de ${studentName(e.studentId)} na turma ${turma}`,
      });
    });
  },

  // --- Sessoes (geradas) + presenca --------------------------------------
  listSessions(filter: {
    classGroupId?: Id;
    dateFrom: DateISO;
    dateTo: DateISO;
  }): Promise<ClassSessionView[]> {
    return simulateRead(() => {
      const groups = store.classGroups.filter(
        (g) =>
          g.status === "active" &&
          (!filter.classGroupId || g.id === filter.classGroupId),
      );
      const out: ClassSessionView[] = [];
      for (const date of datesBetween(filter.dateFrom, filter.dateTo)) {
        const wd = weekdayOf(date);
        for (const g of groups) {
          if (date < g.startDate) continue;
          if (g.endDate && date > g.endDate) continue;
          for (const slot of g.meetingSlots) {
            if (slot.weekday === wd) out.push(toSessionView(g, date, slot));
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
      const position =
        store.waitlist.filter(
          (w) => w.classGroupId === g.id && w.status === "waiting",
        ).length + 1;
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
  // capacidade, pois e uma acao consciente).
  promoteFromWaitlist(id: Id): Promise<EnrollmentView> {
    return simulateWrite(() => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");
      w.status = "promoted";
      const enrollment: Enrollment = {
        id: newId(),
        classGroupId: w.classGroupId,
        studentId: w.studentId,
        status: "active",
        enrolledAt: nowIso(),
      };
      store.enrollments.push(enrollment);
      const student = store.clients.find((c) => c.id === w.studentId);
      return clone({
        ...enrollment,
        studentName: student?.name ?? "",
        studentStatus: student?.status ?? "inactive",
        presentCount: 0,
        absentCount: 0,
        attendanceRate: null,
      });
    });
  },

  removeFromWaitlist(id: Id): Promise<void> {
    return simulateWrite(() => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");
      w.status = "canceled";
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
