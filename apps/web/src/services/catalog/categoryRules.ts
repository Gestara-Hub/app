import type {
  ApiErrorField,
  Category,
  Client,
  CreateCategory,
  Organization,
} from "@gestarahub/contracts";
import { validationError } from "@gestarahub/core/api-error";
import {
  ASSESSMENT_RESULT_MODES,
  ASSESSMENT_SCALES,
  assessmentsEnabled,
  normalizePassingGrade,
  scaleMax,
  validateMinAttendance,
} from "@gestarahub/core/grades";
import { getSegmentPreset, segmentDefaultAssessments } from "@/lib/business-segment-presets";
import { firstLevelForAge, resolveModalityTrack } from "@/lib/progression-tracks";

/**
 * Regras das modalidades, sem store nem banco: a demonstracao roda sobre o
 * store e a conta real na server action (doc 15, fatia 2.1).
 */

type OrgModel = Pick<Organization, "model" | "classSegment" | "customSegmentProgression">;

/** Na academia (turmas) categoria e "modalidade". */
export function categoryNounFor(org: Pick<Organization, "model">): string {
  return org.model === "classes" ? "modalidade" : "categoria";
}

export function validateCategoryPayload(
  payload: Partial<CreateCategory>,
  { partial, noun }: { partial: boolean; noun: string },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateCategory) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: `Informe o nome da ${noun}.` });
    }
  }

  if (payload.assessments) {
    const { scale, passingGrade, resultMode, minAttendancePercent } = payload.assessments;
    if (!ASSESSMENT_SCALES.includes(scale)) {
      fields.push({ field: "assessments.scale", message: "Escolha a escala das notas." });
    } else {
      const check = normalizePassingGrade(scale, passingGrade);
      if (!check.ok) fields.push({ field: "assessments.passingGrade", message: check.message });
    }
    if (resultMode !== undefined && !ASSESSMENT_RESULT_MODES.includes(resultMode)) {
      fields.push({ field: "assessments.resultMode", message: "Escolha como fecha o resultado." });
    }
    if (minAttendancePercent !== undefined && minAttendancePercent !== null) {
      const check = validateMinAttendance(minAttendancePercent);
      if (!check.ok) fields.push({ field: "assessments.minAttendancePercent", message: check.message });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

export function duplicateCategoryNameError(noun: string) {
  return validationError([{ field: "name", message: `Já existe uma ${noun} com esse nome.` }]);
}

/**
 * Avaliacoes normalizadas, campo a campo (so o que o contrato conhece): nota
 * minima na escala, soma dos pontos so nas escalas numericas e frequencia
 * minima valida. Desligada sem config = ausente.
 */
export function normalizedAssessments(payload: Pick<CreateCategory, "assessments">): Category["assessments"] {
  const settings = payload.assessments;
  if (!settings) return undefined;
  const check = normalizePassingGrade(settings.scale, settings.passingGrade);
  const sum = settings.resultMode === "sum" && scaleMax(settings.scale) !== undefined;
  const minAttendance =
    settings.minAttendancePercent !== undefined && settings.minAttendancePercent !== null
      ? validateMinAttendance(settings.minAttendancePercent)
      : null;
  return {
    enabled: Boolean(settings.enabled),
    scale: settings.scale,
    passingGrade: check.ok ? check.value : settings.passingGrade,
    ...(sum ? { resultMode: "sum" as const } : {}),
    ...(minAttendance?.ok ? { minAttendancePercent: minAttendance.value } : {}),
  };
}

/**
 * Modalidade nova sem configuracao de avaliacoes: segue a area do espaco
 * (ligada em idiomas, musica e cursos livres). So no modelo de turmas.
 */
export function defaultAssessmentsForNewModality(org: OrgModel): Category["assessments"] {
  if (org.model !== "classes") return undefined;
  const defaults = segmentDefaultAssessments(
    getSegmentPreset(org.classSegment, org.customSegmentProgression),
  );
  return assessmentsEnabled(defaults) ? defaults : undefined;
}

export function sortCategories(list: Category[]): Category[] {
  return [...list].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
}

/**
 * Alunos da modalidade num nivel que a trilha nova nao tem: voltam ao 1o
 * nivel da idade, sem grau. Grau acima do maximo do nivel cai para o maximo.
 * Altera as graduacoes dos alunos recebidos e devolve os que mudaram e
 * quantos voltaram ao primeiro nivel.
 */
export function resetMissingLevels(
  clients: Client[],
  category: Category,
  today: string,
  now: string,
): { changed: Client[]; reset: number } {
  const track = resolveModalityTrack(category);
  if (!track.enabled || track.levels.length === 0) return { changed: [], reset: 0 };
  const changed: Client[] = [];
  let reset = 0;
  for (const client of clients) {
    const progression = client.progressions?.[category.id];
    if (!progression) continue;
    const level = track.levels.find((l) => l.id === progression.levelId || l.name === progression.levelName);
    if (level) {
      const max = level.maxSubLevels ?? 0;
      if (progression.subLevel > max) {
        progression.subLevel = max;
        changed.push(client);
      }
      continue;
    }
    const first = firstLevelForAge(track, client.birthDate, today) ?? track.levels[0];
    progression.levelId = first.id;
    progression.levelName = first.name;
    progression.levelColor = first.color;
    progression.subLevel = 0;
    progression.maxSubLevels = first.maxSubLevels;
    progression.updatedAt = now;
    changed.push(client);
    reset += 1;
  }
  return { changed, reset };
}
