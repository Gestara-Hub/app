import type {
  Category,
  Client,
  DateISO,
  Id,
  ProgressionBeltColor,
  ProgressionTermSuggestions,
  StudentModalityOverviewItem,
  StudentModalityProgression,
  StudentProgressionOverview,
} from "@gestarahub/contracts";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { store } from "@/services/world/store";
import { newId, notFoundError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { auditLogService } from "../auditLogService";
import { assertCanManageProgression } from "../teacherScope";
import { progressionTermSuggestions } from "./clientProgression";
import { NOT_FOUND, clone, todayISO } from "./clientStore";

/** Graduacao: visao por modalidade, sugestoes, progresso e historico de promocoes. */
export const clientProgressionService = {
  getProgressionOverview(studentId: Id): Promise<StudentProgressionOverview> {
    return readOp(async () => {
      const client = store.clients.find((c) => c.id === studentId);
      if (!client) throw notFoundError(NOT_FOUND);

      const activeEnrollments = store.enrollments.filter(
        (e) => e.studentId === studentId && e.status === "active",
      );
      const enrolledGroupIds = new Set(activeEnrollments.map((e) => e.classGroupId));
      const enrolledGroups = store.classGroups.filter((g) => enrolledGroupIds.has(g.id));

      const categoriesById = new Map<Id, Category>();
      for (const cat of store.categories) {
        if (cat.status === "active") {
          categoriesById.set(cat.id, {
            ...cat,
            progressionTrack: resolveModalityTrack(cat),
          });
        }
      }

      // Garante que modalidades em que o aluno ja tem progresso tambem aparecam
      const existingProgressions = client.progressions ?? {};
      for (const modId of Object.keys(existingProgressions)) {
        if (!categoriesById.has(modId)) {
          const found = store.categories.find((c) => c.id === modId);
          if (found) {
            categoriesById.set(found.id, {
              ...found,
              progressionTrack: resolveModalityTrack(found),
            });
          }
        }
      }

      const items: StudentModalityOverviewItem[] = [];
      for (const modality of categoriesById.values()) {
        const groupsInModality = store.classGroups.filter(
          (g) => g.modalityId === modality.id,
        );
        const groupIdsInModality = new Set(groupsInModality.map((g) => g.id));
        const studentGroupsInModality = enrolledGroups.filter(
          (g) => g.modalityId === modality.id,
        );
        const isEnrolled = studentGroupsInModality.length > 0;
        const progression = existingProgressions[modality.id];
        const promotedAt = progression?.promotedAt;

        let totalPresentInModality = 0;
        let presentSincePromotion = 0;

        for (const att of store.attendances) {
          if (att.studentId !== studentId || att.status !== "present") continue;
          const [groupId, sessionDate] = att.sessionId.split("~");
          if (!groupIdsInModality.has(groupId)) continue;
          totalPresentInModality += 1;
          if (!promotedAt || (sessionDate && sessionDate >= promotedAt)) {
            presentSincePromotion += 1;
          }
        }

        items.push({
          modality,
          isEnrolled,
          enrolledClassNames: studentGroupsInModality.map((g) => g.name),
          presentSincePromotion:
            presentSincePromotion + (progression?.initialAttendanceOffset ?? 0),
          totalPresentInModality:
            totalPresentInModality + (progression?.initialAttendanceOffset ?? 0),
          progression,
        });
      }

      // Ordena primeiro modalidades em que o aluno esta matriculado ou ja possui progresso
      items.sort((a, b) => {
        const aScore = (a.isEnrolled ? 2 : 0) + (a.progression ? 1 : 0);
        const bScore = (b.isEnrolled ? 2 : 0) + (b.progression ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return a.modality.position - b.modality.position;
      });

      return clone({
        studentId: client.id,
        studentName: client.name,
        items,
      });
    });
  },

  /** Sugestoes de pontos fortes e focos para a modalidade (aprendidas do uso). */
  getProgressionTermSuggestions(modalityId: Id): Promise<ProgressionTermSuggestions> {
    return readOp(() => ({
      strengths: progressionTermSuggestions("strengths", modalityId),
      goals: progressionTermSuggestions("goals", modalityId),
    }));
  },

  saveModalityProgression(
    studentId: Id,
    progression: Omit<StudentModalityProgression, "updatedAt">,
  ): Promise<Client> {
    return writeOp(async () => {
      assertCanManageProgression(studentId, { modalityId: progression.modalityId });

      const idx = store.clients.findIndex((c) => c.id === studentId);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.clients[idx];
      const ts = nowIso();
      const nextEntry: StudentModalityProgression = {
        ...progression,
        updatedAt: ts,
      };
      const updated: Client = {
        ...current,
        progressions: {
          ...(current.progressions ?? {}),
          [progression.modalityId]: nextEntry,
        },
        updatedAt: ts,
      };
      store.clients[idx] = updated;
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `atualizou o progresso de ${updated.name} (${progression.levelName})`,
      });
      return clone(updated);
    });
  },

  promoteStudent(payload: {
    studentId: Id;
    modalityId: Id;
    modalityName?: string;
    toLevelId?: string;
    toLevelName: string;
    toLevelColor?: ProgressionBeltColor;
    toSubLevel: number;
    maxSubLevels?: number;
    date: DateISO;
    attendancesCompleted?: number;
    monthsInLevel?: number;
    isExam?: boolean;
    notes?: string;
    examiner?: string;
  }): Promise<Client> {
    return writeOp(async () => {
      assertCanManageProgression(payload.studentId, { modalityId: payload.modalityId });
      if (payload.date > todayISO()) {
        throw validationError([{ field: "date", message: "A data não pode ser futura." }]);
      }

      const idx = store.clients.findIndex((c) => c.id === payload.studentId);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.clients[idx];
      const ts = nowIso();
      const prev = current.progressions?.[payload.modalityId];

      const historyEntry = {
        id: newId(),
        date: payload.date,
        fromLevelName: prev?.levelName,
        fromSubLevel: prev?.subLevel,
        toLevelName: payload.toLevelName,
        toLevelColor: payload.toLevelColor,
        toSubLevel: payload.toSubLevel,
        attendancesCompleted: payload.attendancesCompleted,
        monthsInLevel: payload.monthsInLevel,
        isExam: payload.isExam,
        notes: payload.notes?.trim() || undefined,
        examiner: payload.examiner?.trim() || undefined,
        createdAt: ts,
      };

      const nextProgression: StudentModalityProgression = {
        modalityId: payload.modalityId,
        modalityName: payload.modalityName ?? prev?.modalityName,
        levelId: payload.toLevelId,
        levelName: payload.toLevelName,
        levelColor: payload.toLevelColor,
        subLevel: payload.toSubLevel,
        maxSubLevels: payload.maxSubLevels ?? prev?.maxSubLevels ?? 4,
        promotedAt: payload.date,
        initialAttendanceOffset: 0,
        origin: prev?.origin,
        originAcademy: prev?.originAcademy,
        originTeacher: prev?.originTeacher,
        nextExamDate: undefined,
        strengths: prev?.strengths ?? [],
        goals: prev?.goals ?? [],
        evaluations: prev?.evaluations ?? [],
        promotionHistory: [historyEntry, ...(prev?.promotionHistory ?? [])],
        updatedAt: ts,
      };

      const updated: Client = {
        ...current,
        progressions: {
          ...(current.progressions ?? {}),
          [payload.modalityId]: nextProgression,
        },
        updatedAt: ts,
      };
      store.clients[idx] = updated;
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `graduou ${updated.name} para ${payload.toLevelName}${payload.toSubLevel > 0 ? ` (${payload.toSubLevel}º grau)` : ""}`,
      });
      return clone(updated);
    });
  },
};
