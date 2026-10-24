import type {
  ClassSessionDetail,
  ClassSessionOverride,
  Id,
  SubstituteInstructorPayload,
} from "@gestarahub/contracts";
import { teamWords } from "@/services/world/nouns";
import { format, parseISO } from "date-fns";
import { notFoundError, nowIso, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { clone, instructorName, resolveSession } from "./classShared";
import { validateSubstituteConflict } from "./classValidation";
import { buildSessionDetail } from "./classViews";

export const sessionOverridesService = {
  substituteInstructor(
    sessionId: Id,
    payload: SubstituteInstructorPayload,
  ): Promise<ClassSessionDetail> {
    return writeOp(async () => {
      const { g, date, slot } = resolveSession(sessionId);

      const instructor = store.professionals.find((x) => x.id === payload.instructorId);
      if (!instructor) throw notFoundError(`${teamWords().title} não encontrado.`);
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

      if (existingIndex !== -1) {
        store.sessionOverrides[existingIndex] = overrideRecord;
      } else {
        store.sessionOverrides.push(overrideRecord);
      }
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id: g.id, label: g.name },
        predicate: `colocou ${instructor.name} no lugar de ${instructorName(g.instructorId) || `o ${teamWords().lower}`} na aula de ${format(parseISO(date), "dd/MM")} da turma ${g.name}`,
      });

      return clone(buildSessionDetail(sessionId));
    });
  },

  restorePrimaryInstructor(sessionId: Id): Promise<ClassSessionDetail> {
    return writeOp(async () => {

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
            predicate: `voltou ${instructorName(g.instructorId) || `o ${teamWords().lower}`} para a aula de ${format(parseISO(date), "dd/MM")} da turma ${g.name}`,
          });
        }
      }
      return clone(buildSessionDetail(sessionId));
    });
  },
};
