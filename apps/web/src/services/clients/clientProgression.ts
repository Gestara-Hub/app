import type {
  Client,
  CreateStudentClassRecord,
  DateISO,
  Id,
  StudentEvaluationEntry,
  StudentGoal,
  StudentGoalProgressEntry,
  StudentModalityProgression,
} from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { firstLevelForAge, resolveModalityTrack } from "@/lib/progression-tracks";
import { getCurrentActor } from "@/services/world/actor";
import { store } from "@/services/world/store";
import { newId, normalizeText, notFoundError, nowIso } from "@/services/world/ops";

// --- Sugestoes da evolucao (aprendidas do uso) ----------------------------

export type ProgressionTermKind = "strengths" | "goals";

/** Ate quantos termos a sugestao devolve (a tela mostra 6; a busca ao digitar usa todos). */
const MAX_TERM_SUGGESTIONS = 40;

/**
 * Termos ja usados (pontos fortes ou focos) NA modalidade, do mais usado ao
 * menos. So a propria modalidade: termos de Jiu-Jitsu nao sugerem no Muay Thai.
 * Cada aluno conta uma vez por termo; maiusculas e acentos nao diferenciam, e
 * a grafia exibida e a mais usada.
 */
export function progressionTermSuggestions(kind: ProgressionTermKind, modalityId: Id): string[] {
  const byKey = new Map<string, { students: Set<Id>; spellings: Map<string, number> }>();
  for (const client of store.clients) {
    const progression = client.progressions?.[modalityId];
    if (!progression) continue;
    const terms = kind === "strengths" ? progression.strengths ?? [] : (progression.goals ?? []).map((g) => g.title);
    for (const raw of terms) {
      const term = raw.trim();
      const key = normalizeText(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? { students: new Set<Id>(), spellings: new Map<string, number>() };
      entry.students.add(client.id);
      entry.spellings.set(term, (entry.spellings.get(term) ?? 0) + 1);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((entry) => ({
      count: entry.students.size,
      label: [...entry.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0][0],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, MAX_TERM_SUGGESTIONS)
    .map((term) => term.label);
}

// --- Progresso por modalidade (graduacao, metas, registros) -----------------

/** Progresso do aluno na modalidade; sem registro ainda, comeca no 1o nivel. */
export function progressionOf(client: Client, modalityId: Id, date: DateISO): StudentModalityProgression {
  const prev = client.progressions?.[modalityId];
  if (prev) {
    return {
      ...prev,
      strengths: [...(prev.strengths ?? [])],
      goals: (prev.goals ?? []).map((g) => ({ ...g })),
      evaluations: [...(prev.evaluations ?? [])],
    };
  }
  const modality = store.categories.find((c) => c.id === modalityId);
  // Comeca no 1o nivel da idade, como o "Comecou aqui" do ponto de partida.
  const firstLevel = firstLevelForAge(resolveModalityTrack(modality), client.birthDate, date) ?? {
    id: "lvl-default",
    name: "Iniciante",
    color: "white" as const,
    maxSubLevels: 4,
  };
  // "Desde": quando entrou na modalidade (1a matricula numa turma dela), nao a
  // data do registro, que nao e graduacao.
  const groupIds = new Set(store.classGroups.filter((g) => g.modalityId === modalityId).map((g) => g.id));
  const since =
    store.enrollments
      .filter((e) => e.studentId === client.id && groupIds.has(e.classGroupId))
      .map((e) => format(parseISO(e.enrolledAt), "yyyy-MM-dd"))
      .sort()[0] ?? (client.createdAt ? format(parseISO(client.createdAt), "yyyy-MM-dd") : date);
  return {
    modalityId,
    modalityName: modality?.name,
    levelId: firstLevel.id,
    levelName: firstLevel.name,
    levelColor: firstLevel.color,
    subLevel: 0,
    maxSubLevels: firstLevel.maxSubLevels,
    promotedAt: since < date ? since : date,
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: nowIso(),
  };
}

/** Grava o progresso da modalidade no aluno (substitui o registro do indice). */
export async function writeProgression(idx: number, progression: StudentModalityProgression): Promise<Client> {
  const current = store.clients[idx];
  const ts = nowIso();
  const nextProgression = { ...progression, updatedAt: ts };
  const updated: Client = {
    ...current,
    progressions: {
      ...(current.progressions ?? {}),
      [progression.modalityId]: nextProgression,
    },
    updatedAt: ts,
  };
  store.clients[idx] = updated;

  return updated;
}

export function findGoal(progression: StudentModalityProgression, goalId: Id): StudentGoal {
  const goal = progression.goals.find((g) => g.id === goalId);
  if (!goal) throw notFoundError("Meta não encontrada.");
  return goal;
}

/**
 * Soma o avanco das metas no registro (com alvo: +amount, feita ao chegar no
 * alvo; sem alvo: `completed` marca como feita). Devolve o resumo para o registro.
 */
export function applyGoalProgress(
  progression: StudentModalityProgression,
  items: CreateStudentClassRecord["goalProgress"],
  date: DateISO,
): StudentGoalProgressEntry[] {
  const entries: StudentGoalProgressEntry[] = [];
  for (const item of items ?? []) {
    const goal = progression.goals.find((g) => g.id === item.goalId);
    if (!goal || goal.completedAt) continue;
    if (goal.target) {
      const amount = Math.max(0, Math.round(item.amount ?? 0));
      if (amount === 0) continue;
      goal.progress = Math.min(goal.target, goal.progress + amount);
      const completed = goal.progress >= goal.target;
      if (completed) goal.completedAt = date;
      entries.push({ goalId: goal.id, title: goal.title, amount, ...(completed ? { completed } : {}) });
    } else if (item.completed) {
      goal.completedAt = date;
      entries.push({ goalId: goal.id, title: goal.title, completed: true });
    }
  }
  return entries;
}

export function newClassRecord(
  input: Omit<StudentEvaluationEntry, "id" | "createdAt" | "authorName">,
): StudentEvaluationEntry {
  const author = getCurrentActor()?.name;
  return {
    id: newId(),
    ...input,
    ...(author ? { authorName: author } : {}),
    createdAt: nowIso(),
  };
}
