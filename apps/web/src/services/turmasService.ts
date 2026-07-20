import type {
  ApiErrorField,
  AttendanceStatus,
  ClassGroup,
  ClassGroupFilter,
  ClassGroupView,
  ClassMeetingSlot,
  ClassSessionDetail,
  ClassSessionView,
  CreateClassGroup,
  CreateEnrollment,
  DateISO,
  Enrollment,
  EnrollmentView,
  Id,
  SessionRosterEntry,
  TimeISO,
  UpdateClassGroup,
} from "@gestarahub/contracts";
import { addDays, format, parseISO } from "date-fns";
import { weekdayOf } from "@gestarahub/core/scheduling";
import { store } from "@/mocks/store";
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

function toGroupView(g: ClassGroup): ClassGroupView {
  const enrolledCount = activeEnrollments(g.id).length;
  return {
    ...g,
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(g.instructorId),
    enrolledCount,
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
  return {
    id: makeSessionId(g.id, date, slot.start),
    classGroupId: g.id,
    date,
    start: slot.start,
    end: slot.end,
    instructorId: g.instructorId,
    status: date < todayISO() ? "done" : "scheduled",
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    className: g.name,
    modalityName: modalityName(g.modalityId),
    instructorName: instructorName(g.instructorId),
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

function validateGroup(payload: Partial<CreateClassGroup>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome da turma." });
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
      validateGroup(payload);
      const ts = nowIso();
      const g: ClassGroup = { ...payload, id: newId(), createdAt: ts, updatedAt: ts };
      store.classGroups.push(g);
      return clone(toGroupView(g));
    });
  },

  update(id: Id, payload: UpdateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(() => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      validateGroup({ ...store.classGroups[idx], ...payload });
      store.classGroups[idx] = {
        ...store.classGroups[idx],
        ...payload,
        updatedAt: nowIso(),
      };
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
      return clone({
        ...enrollment,
        studentName: student.name,
        studentStatus: student.status,
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
    return simulateRead(() => {
      const p = parseSessionId(id);
      const g = p
        ? store.classGroups.find((x) => x.id === p.classGroupId)
        : undefined;
      if (!p || !g) throw notFoundError("Aula não encontrada.");
      const slot = g.meetingSlots.find((s) => s.start === p.start);
      if (!slot) throw notFoundError("Aula não encontrada.");
      const view = toSessionView(g, p.date, slot);
      const roster: SessionRosterEntry[] = activeEnrollments(g.id)
        .map((e) => ({
          studentId: e.studentId,
          studentName: studentName(e.studentId),
          attendance: store.attendances.find(
            (a) => a.sessionId === id && a.studentId === e.studentId,
          )?.status,
        }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
      return clone({ ...view, roster });
    });
  },

  markAttendance(input: {
    sessionId: Id;
    studentId: Id;
    status: AttendanceStatus;
  }): Promise<void> {
    return simulateWrite(() => {
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
};
