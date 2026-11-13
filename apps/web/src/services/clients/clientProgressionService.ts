import { clientForActor } from "./studentSummaryRules";
import type {
  Category,
  Client,
  DateISO,
  Id,
  PromoteStudentsInput,
  PromotionCandidate,
  PromotionCandidates,
  ProgressionBeltColor,
  ProgressionTermSuggestions,
  StudentModalityOverviewItem,
  StudentModalityProgression,
  StudentProgressionOverview,
  StudentStageGrades,
} from "@gestarahub/contracts";
import { ageAt, currentLevelOf, resolveModalityTrack } from "@/lib/progression-tracks";
import { store } from "@/services/world/store";
import { newId, notFoundError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { assertCanManageProgression, assertTeacherSeesStudent } from "../classes/teacherScope";
import { studentStageGrades } from "../grades/stageGrades";
import { progressionTermSuggestions } from "./clientProgression";
import { NOT_FOUND, clone, todayISO } from "./clientStore";

/** Graduacao: visao por modalidade, sugestoes, progresso e historico de promocoes. */
export const clientProgressionService = {
  getProgressionOverview(studentId: Id): Promise<StudentProgressionOverview> {
    return readOp(async () => {
      const client = store.clients.find((c) => c.id === studentId);
      if (!client) throw notFoundError(NOT_FOUND);
      // Professor: so os alunos das turmas dele (revisao geral de 31/10/2026, achado S4).
      assertTeacherSeesStudent(studentId, "Você só vê a evolução dos alunos das suas turmas.");

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

      const age = ageAt(client.birthDate, todayISO());
      const items: StudentModalityOverviewItem[] = [];
      for (const modality of categoriesById.values()) {
        const studentGroupsInModality = enrolledGroups.filter(
          (g) => g.modalityId === modality.id,
        );
        const progression = existingProgressions[modality.id];
        const facts = progressFacts(client, modality, age);
        items.push({
          modality,
          isEnrolled: studentGroupsInModality.length > 0,
          enrolledClassNames: studentGroupsInModality.map((g) => g.name),
          presentSincePromotion: facts.presentSincePromotion,
          totalPresentInModality: facts.totalPresentInModality,
          progression,
          ...(facts.stageGrades ? { stageGrades: facts.stageGrades } : {}),
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

  /**
   * "Graduar vários" (doc product/30 §3): os alunos pedidos na modalidade, com
   * o nivel, as aulas desde a ultima graduacao e as notas da etapa. A tela
   * calcula o passo sugerido e o "Apto" com as mesmas regras do individual.
   */
  listPromotionCandidates(modalityId: Id, studentIds: Id[]): Promise<PromotionCandidates> {
    return readOp(async () => {
      const found = store.categories.find((c) => c.id === modalityId);
      if (!found) throw notFoundError("Modalidade não encontrada.");
      const modality: Category = { ...found, progressionTrack: resolveModalityTrack(found) };
      const today = todayISO();
      const candidates: PromotionCandidate[] = [];
      for (const studentId of new Set(studentIds)) {
        const client = store.clients.find((c) => c.id === studentId);
        if (!client) continue;
        assertTeacherSeesStudent(studentId, "Você só vê a evolução dos alunos das suas turmas.");
        const facts = progressFacts(client, modality, ageAt(client.birthDate, today));
        candidates.push({
          studentId,
          studentName: client.name,
          ...(client.birthDate ? { birthDate: client.birthDate } : {}),
          ...(client.progressions?.[modalityId] ? { progression: client.progressions[modalityId] } : {}),
          presentSincePromotion: facts.presentSincePromotion,
          ...(facts.stageGrades ? { stageGrades: facts.stageGrades } : {}),
        });
      }
      candidates.sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
      return clone({ modality, candidates });
    });
  },

  /**
   * Graduar varios de uma vez (doc product/30 §3): mesma data, examinador e
   * observacao; cada aluno ganha o registro normal no historico e a linha na
   * Auditoria. Tudo ou nada: confere todos antes de gravar. Quem nao esta apto
   * pode entrar (a tela confirma antes; decisao 3 do doc 30).
   */
  promoteStudents(input: PromoteStudentsInput): Promise<{ promoted: number }> {
    return writeOp(async () => {
      if (!input.date || input.date > todayISO()) {
        throw validationError([{ field: "date", message: "A data não pode ser futura." }]);
      }
      const found = store.categories.find((c) => c.id === input.modalityId);
      const track = found ? resolveModalityTrack(found) : undefined;
      if (!found || !track?.enabled) {
        throw validationError([{ field: "modalityId", message: "A modalidade não tem trilha de níveis." }]);
      }
      const seen = new Set<Id>();
      const items = input.items.filter((i) => !seen.has(i.studentId) && seen.add(i.studentId));
      if (items.length === 0) {
        throw validationError([{ field: "items", message: "Escolha ao menos um aluno." }]);
      }
      const payloads = items.map((item): PromotionPayload => {
        assertCanManageProgression(item.studentId, { modalityId: found.id });
        const client = store.clients.find((c) => c.id === item.studentId);
        if (!client) throw notFoundError(NOT_FOUND);
        const level = track.levels.find((l) => l.id === item.toLevelId);
        if (!level || item.toSubLevel < 0 || item.toSubLevel > level.maxSubLevels) {
          throw validationError([{ field: "items", message: `Escolha para onde ${client.name} vai.` }]);
        }
        const prev = client.progressions?.[found.id];
        const age = ageAt(client.birthDate, input.date);
        const current = currentLevelOf(track, prev, age);
        if (current?.id === level.id && (prev?.subLevel ?? 0) === item.toSubLevel) {
          throw validationError([{ field: "items", message: `${client.name} já está em ${level.name}.` }]);
        }
        return {
          studentId: client.id,
          modalityId: found.id,
          modalityName: found.name,
          toLevelId: level.id,
          toLevelName: level.name,
          toLevelColor: level.color,
          toSubLevel: item.toSubLevel,
          maxSubLevels: level.maxSubLevels,
          date: input.date,
          attendancesCompleted: progressFacts(client, { ...found, progressionTrack: track }, age).presentSincePromotion,
          monthsInLevel: monthsBetween(prev?.promotedAt, input.date),
          notes: input.notes,
          examiner: input.examiner,
        };
      });
      for (const payload of payloads) recordPromotion(payload);
      return { promoted: payloads.length };
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
      return clone(clientForActor(updated));
    });
  },

  promoteStudent(payload: PromotionPayload): Promise<Client> {
    return writeOp(async () => {
      assertCanManageProgression(payload.studentId, { modalityId: payload.modalityId });
      if (payload.date > todayISO()) {
        throw validationError([{ field: "date", message: "A data não pode ser futura." }]);
      }
      return clone(clientForActor(recordPromotion(payload)));
    });
  },
};

export interface PromotionPayload {
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
}

/**
 * Grava uma graduacao no historico do aluno e na Auditoria, sem conferir
 * permissao nem data (quem chama confere): o Graduar e a troca de turma com
 * "Subir de nivel junto" (doc product/30 §2) usam a mesma gravacao.
 */
export function recordPromotion(payload: PromotionPayload): Client {
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
  return updated;
}

/**
 * Numa modalidade (com a trilha ja resolvida): presencas totais e desde a
 * ultima graduacao (com o ponto de partida) e as notas da etapa atual.
 */
function progressFacts(
  client: Client,
  modality: Category,
  age: number | null,
): { presentSincePromotion: number; totalPresentInModality: number; stageGrades?: StudentStageGrades } {
  const groupIds = new Set(store.classGroups.filter((g) => g.modalityId === modality.id).map((g) => g.id));
  const progression = client.progressions?.[modality.id];
  const promotedAt = progression?.promotedAt;
  let total = 0;
  let since = 0;
  for (const att of store.attendances) {
    if (att.studentId !== client.id || att.status !== "present") continue;
    const [groupId, sessionDate] = att.sessionId.split("~");
    if (!groupIds.has(groupId)) continue;
    total += 1;
    if (!promotedAt || (sessionDate && sessionDate >= promotedAt)) since += 1;
  }
  const offset = progression?.initialAttendanceOffset ?? 0;
  // Notas da etapa atual, para o "Apto" (doc product/30 §1).
  const track = modality.progressionTrack;
  const stageGrades = track?.enabled
    ? studentStageGrades(modality.id, client.id, track, {
        levelId: currentLevelOf(track, progression, age)?.id,
        since: promotedAt,
      })
    : undefined;
  return { presentSincePromotion: since + offset, totalPresentInModality: total + offset, ...(stageGrades ? { stageGrades } : {}) };
}

/** Meses inteiros (30 dias) entre duas datas, como o "Tempo no nivel" da tela. */
function monthsBetween(from: DateISO | undefined, to: DateISO): number {
  if (!from) return 0;
  const days = Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  return Math.max(0, Math.floor(days / 30));
}
