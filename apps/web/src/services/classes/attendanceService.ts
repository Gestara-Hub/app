import type {
  Attendance,
  AttendanceStatus,
  AttendanceSummary,
  AbsenceStreakView,
  DateISO,
  Id,
} from "@gestarahub/contracts";
import { apiError, newId, nowIso, readOp, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { assertTeacherSession } from "./teacherScope";
import { syncAttendanceUsage, auditPackageUsage } from "./attendancePackageUsage";
import { todayISO, parseSessionId, resolveSession } from "./classShared";

export const attendanceService = {
  markAttendance(input: {
    sessionId: Id;
    studentId: Id;
    status: AttendanceStatus;
  }): Promise<void> {
    return writeOp(async () => {
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
      auditPackageUsage(usage, g, date, input.studentId, input.status);
    });
  },

  /** Desmarca a presenca (volta a "a marcar") e devolve a aula do pacote, se gastou. */
  clearAttendance(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return writeOp(async () => {
      const { g, date } = resolveSession(input.sessionId);
      assertTeacherSession(g, input.sessionId);

      store.attendances = store.attendances.filter(
        (a) => !(a.sessionId === input.sessionId && a.studentId === input.studentId),
      );
      const usage = syncAttendanceUsage(input.sessionId, input.studentId);
      // Apaga a presenca e devolve a aula do pacote na mesma transacao.
      auditPackageUsage(usage, g, date, input.studentId);
    });
  },

  getAttendanceSummary(date: DateISO): Promise<AttendanceSummary> {
    return readOp(async () => {
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

  /**
   * Alunos ativos com pelo menos `minStreak` faltas seguidas nas turmas em que
   * estao matriculados (so aulas com chamada feita). Presenca ou falta
   * justificada encerram a sequencia. Mais faltas primeiro.
   */
  listAbsenceStreaks(minStreak = 3): Promise<AbsenceStreakView[]> {
    return readOp(async () => {
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
};
