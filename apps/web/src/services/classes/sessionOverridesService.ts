import type {
  ClassSessionDetail,
  ClassSessionOverride,
  Id,
  SubstituteInstructorPayload,
} from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { isSupabaseOrganization } from "@/lib/session";
import { notFoundError, nowIso, simulateWrite } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { deleteSessionOverrideInDb, upsertSessionOverrideInDb } from "../turmasBackend";
import { clone, instructorName, resolveSession } from "./classShared";
import { validateSubstituteConflict } from "./classValidation";
import { buildSessionDetail } from "./classViews";

export const sessionOverridesService = {
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
};
