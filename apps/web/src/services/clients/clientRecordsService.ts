import type {
  ApiErrorField,
  Client,
  CreateClassRecordsBatch,
  CreateStudentClassRecord,
  Id,
} from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { newId, nowIso, simulateWrite, validationError } from "@/mocks/helpers";
import { auditLogService } from "../auditLogService";
import { assertCanManageProgression } from "../teacherScope";
import {
  applyGoalProgress,
  findGoal,
  newClassRecord,
  progressionOf,
  writeProgression,
} from "./clientProgression";
import { clone, ensureClientInStore, todayISO } from "./clientStore";
import { assertRecordDate } from "./clientValidation";

/** Registros de aula, pontos fortes e metas do aluno por modalidade. */
export const clientRecordsService = {
  /** Registro de aula de um aluno: anotacao, avanco de metas e lembrete. */
  addClassRecord(payload: CreateStudentClassRecord): Promise<Client> {
    return simulateWrite(async () => {
      assertRecordDate(payload.date);
      assertCanManageProgression(payload.studentId, {
        modalityId: payload.modalityId,
        classGroupId: payload.classGroupId,
        sessionId: payload.sessionId,
      });
      const note = payload.note?.trim() ?? "";
      const nextClassNote = payload.nextClassNote?.trim() ?? "";
      const hasGoals = (payload.goalProgress ?? []).some((g) => (g.amount ?? 0) > 0 || g.completed);
      if (!note && !nextClassNote && !hasGoals) {
        throw validationError([{ field: "note", message: "Escreva uma anotação ou avance uma meta." }]);
      }
      const idx = await ensureClientInStore(payload.studentId);
      const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
      const goalProgress = applyGoalProgress(progression, payload.goalProgress, payload.date);
      const record = newClassRecord({
        date: payload.date,
        classGroupId: payload.classGroupId,
        classGroupName: payload.classGroupName,
        sessionId: payload.sessionId,
        tone: payload.tone,
        note,
        ...(nextClassNote ? { nextClassNote } : {}),
        ...(goalProgress.length ? { goalProgress } : {}),
      });
      progression.evaluations = [record, ...progression.evaluations];
      const updated = await writeProgression(idx, progression);
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `registrou a aula de ${updated.name}${payload.classGroupName ? ` (${payload.classGroupName})` : ""}`,
      });
      return clone(updated);
    });
  },

  /**
   * Registro da turma inteira pela chamada: um registro na ficha de cada aluno
   * marcado (tom ou anotacao). Com anotacao da turma, todos os listados ganham.
   * Devolve quantos registros criou.
   */
  addClassRecords(payload: CreateClassRecordsBatch): Promise<number> {
    return simulateWrite(async () => {
      assertRecordDate(payload.date);
      for (const entry of payload.entries) {
        assertCanManageProgression(entry.studentId, {
          modalityId: payload.modalityId,
          classGroupId: payload.classGroupId,
          sessionId: payload.sessionId,
        });
      }
      const classNote = payload.classNote?.trim() ?? "";
      let created = 0;
      let removed = 0;
      for (const entry of payload.entries) {
        const note = entry.note?.trim() ?? "";
        const idx = store.clients.findIndex((c) => c.id === entry.studentId);
        if (idx === -1) continue;
        // Um registro por aluno e aula: registrar de novo troca o anterior.
        const current = store.clients[idx].progressions?.[payload.modalityId];
        const hadRecord = Boolean(current?.evaluations.some((e) => e.sessionId === payload.sessionId));
        if (!entry.tone && !note && !classNote) {
          if (hadRecord && current) {
            const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
            progression.evaluations = progression.evaluations.filter((e) => e.sessionId !== payload.sessionId);
            await writeProgression(idx, progression);
            removed += 1;
          }
          continue;
        }
        const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
        progression.evaluations = [
          newClassRecord({
            date: payload.date,
            classGroupId: payload.classGroupId,
            classGroupName: payload.classGroupName,
            sessionId: payload.sessionId,
            tone: entry.tone ?? "general",
            note,
            ...(classNote ? { classNote } : {}),
          }),
          ...progression.evaluations.filter((e) => e.sessionId !== payload.sessionId),
        ];
        await writeProgression(idx, progression);
        created += 1;
      }
      if (created === 0 && removed === 0) {
        throw validationError([{ field: "entries", message: "Marque ao menos um aluno ou escreva a anotação da turma." }]);
      }
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id: payload.classGroupId, label: payload.classGroupName },
        predicate: `registrou a aula de ${payload.classGroupName} (${plural(created, "aluno", "alunos")})`,
      });
      return created;
    });
  },

  /** Pontos fortes do aluno na modalidade. */
  updateStrengths(studentId: Id, modalityId: Id, strengths: string[]): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      progression.strengths = [...new Set(strengths.map((t) => t.trim()).filter(Boolean))];
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  addGoal(studentId: Id, modalityId: Id, input: { title: string; target?: number }): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const title = input.title.trim();
      const fields: ApiErrorField[] = [];
      if (!title) fields.push({ field: "title", message: "Informe a meta." });
      else if (title.length > 80) fields.push({ field: "title", message: "Use no máximo 80 caracteres." });
      if (input.target !== undefined && (!Number.isInteger(input.target) || input.target < 1)) {
        fields.push({ field: "target", message: "Informe uma quantidade maior que zero." });
      }
      if (fields.length > 0) throw validationError(fields);
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      progression.goals = [
        ...progression.goals,
        {
          id: newId(),
          title,
          ...(input.target ? { target: input.target } : {}),
          progress: 0,
          createdAt: nowIso(),
        },
      ];
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  /** Marca a meta como feita ou reabre. */
  setGoalCompleted(studentId: Id, modalityId: Id, goalId: Id, completed: boolean): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      const goal = findGoal(progression, goalId);
      if (completed) {
        goal.completedAt = todayISO();
        if (goal.target) goal.progress = goal.target;
      } else {
        delete goal.completedAt;
        if (goal.target && goal.progress >= goal.target) goal.progress = goal.target - 1;
      }
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  removeGoal(studentId: Id, modalityId: Id, goalId: Id): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      findGoal(progression, goalId);
      progression.goals = progression.goals.filter((g) => g.id !== goalId);
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },
};
