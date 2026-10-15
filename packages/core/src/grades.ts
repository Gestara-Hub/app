import type {
  AssessmentGradeStatus,
  AssessmentScale,
  ConceptGrade,
  GradeAverage,
  GradeValue,
  ModalityAssessmentSettings,
  PassFailGrade,
} from "@gestarahub/contracts";

/**
 * Notas dos alunos (doc 21 §2.1, fase 1): escala, validacao, media ponderada e
 * arredondamento. O servico (mock hoje, API amanha) so guarda e chama estas
 * funcoes, para a regra nunca divergir entre a lista, o lancamento e o boletim.
 *
 * Arredondamento (metade para cima, so no fim da conta):
 * - 0 a 10: uma casa decimal (6,25 vira 6,3);
 * - 0 a 100: inteiro (59,5 vira 60);
 * - conceito: cada letra vale A=10, B=8, C=6, D=4, E=2; a media numerica
 *   (uma casa) volta para a letra mais proxima (9 ou mais = A, 7 = B, 5 = C,
 *   3 = D, abaixo = E);
 * - apto/nao apto: a media e a fracao de aptos (duas casas); apto pela maioria
 *   (metade ou mais).
 * "Faltou" e "Sem nota" ficam fora da media. A media geral pondera todas as
 * notas (nao e a media das medias das etapas).
 */

export const ASSESSMENT_SCALES: readonly AssessmentScale[] = ["zero_ten", "zero_hundred", "concept", "pass_fail"];
export const CONCEPT_GRADES: readonly ConceptGrade[] = ["A", "B", "C", "D", "E"];
export const DEFAULT_ASSESSMENT_SCALE: AssessmentScale = "zero_ten";
export const DEFAULT_ASSESSMENT_WEIGHT = 1;
export const MAX_ASSESSMENT_WEIGHT = 100;
export const MAX_ASSESSMENT_NAME_LENGTH = 80;

const CONCEPT_POINTS: Record<ConceptGrade, number> = { A: 10, B: 8, C: 6, D: 4, E: 2 };

/** Nota minima padrao de cada escala. */
export function defaultPassingGrade(scale: AssessmentScale): GradeValue {
  switch (scale) {
    case "zero_ten":
      return 6;
    case "zero_hundred":
      return 60;
    case "concept":
      return "C";
    case "pass_fail":
      return "pass";
  }
}

/** Configuracao padrao (desligada ou ligada) numa escala. */
export function defaultAssessmentSettings(
  enabled: boolean,
  scale: AssessmentScale = DEFAULT_ASSESSMENT_SCALE,
): ModalityAssessmentSettings {
  return { enabled, scale, passingGrade: defaultPassingGrade(scale) };
}

/** A modalidade tem avaliacoes ligadas? */
export function assessmentsEnabled(
  settings: ModalityAssessmentSettings | undefined,
): settings is ModalityAssessmentSettings {
  return Boolean(settings?.enabled);
}

/** Arredonda metade para cima em `decimals` casas, sem erro de ponto flutuante. */
export function roundHalfUp(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export type GradeCheck = { ok: true; value: GradeValue } | { ok: false; message: string };

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

/**
 * Valida e normaliza uma nota na escala. Aceita numero ou texto ("7,5", "7.5",
 * "b", "apto"). 0 a 10: uma casa decimal; 0 a 100: inteiro; conceito: A a E;
 * apto/nao apto: `pass`/`fail`.
 */
export function normalizeGrade(scale: AssessmentScale, raw: unknown): GradeCheck {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: false, message: "Informe a nota." };
  }
  switch (scale) {
    case "zero_ten": {
      const n = toNumber(raw);
      if (n === null || n < 0 || n > 10) return { ok: false, message: "A nota vai de 0 a 10." };
      if (roundHalfUp(n, 1) !== n) return { ok: false, message: "Use no máximo uma casa decimal." };
      return { ok: true, value: n };
    }
    case "zero_hundred": {
      const n = toNumber(raw);
      if (n === null || n < 0 || n > 100) return { ok: false, message: "A nota vai de 0 a 100." };
      if (!Number.isInteger(n)) return { ok: false, message: "Use uma nota inteira." };
      return { ok: true, value: n };
    }
    case "concept": {
      const letter = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (!(CONCEPT_GRADES as readonly string[]).includes(letter)) {
        return { ok: false, message: "Escolha um conceito de A a E." };
      }
      return { ok: true, value: letter as ConceptGrade };
    }
    case "pass_fail": {
      const text = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      if (text === "pass" || text === "apto") return { ok: true, value: "pass" };
      if (text === "fail" || text === "não apto" || text === "nao apto") return { ok: true, value: "fail" };
      return { ok: false, message: "Escolha apto ou não apto." };
    }
  }
}

/** Nota mínima válida para a escala (apto/não apto exige "pass"). */
export function normalizePassingGrade(scale: AssessmentScale, raw: unknown): GradeCheck {
  if (scale === "pass_fail") return { ok: true, value: "pass" };
  return normalizeGrade(scale, raw);
}

/** Nota na escala interna numerica (conceito em 2 a 10, apto em 1/0). */
export function gradeToNumeric(scale: AssessmentScale, value: GradeValue): number {
  switch (scale) {
    case "zero_ten":
    case "zero_hundred":
      return typeof value === "number" ? value : Number.NaN;
    case "concept":
      return CONCEPT_POINTS[value as ConceptGrade] ?? Number.NaN;
    case "pass_fail":
      return value === "pass" ? 1 : value === "fail" ? 0 : Number.NaN;
  }
}

/** Letra mais proxima de uma media numerica de conceito (2 a 10). */
export function conceptFromNumeric(numeric: number): ConceptGrade {
  if (numeric >= 9) return "A";
  if (numeric >= 7) return "B";
  if (numeric >= 5) return "C";
  if (numeric >= 3) return "D";
  return "E";
}

/** Nota abaixo da minima? (apto/não apto: "fail" fica abaixo). */
export function isBelowPassing(scale: AssessmentScale, value: GradeValue, passingGrade: GradeValue): boolean {
  if (scale === "pass_fail") return value !== "pass";
  return gradeToNumeric(scale, value) < gradeToNumeric(scale, passingGrade);
}

export interface WeightedGrade {
  status: AssessmentGradeStatus;
  value?: GradeValue;
  weight: number;
}

/**
 * Media ponderada das notas lancadas (faltou e sem nota ficam fora). Devolve
 * null sem nenhuma nota. Ver as regras de arredondamento no topo do arquivo.
 */
export function averageGrades(
  settings: Pick<ModalityAssessmentSettings, "scale" | "passingGrade">,
  items: readonly WeightedGrade[],
): GradeAverage | null {
  const { scale, passingGrade } = settings;
  let sum = 0;
  let totalWeight = 0;
  let count = 0;
  for (const item of items) {
    if (item.status !== "graded" || item.value === undefined) continue;
    const numeric = gradeToNumeric(scale, item.value);
    if (!Number.isFinite(numeric) || !(item.weight > 0)) continue;
    sum += numeric * item.weight;
    totalWeight += item.weight;
    count += 1;
  }
  if (count === 0 || totalWeight === 0) return null;
  const mean = sum / totalWeight;
  let value: GradeValue;
  let numeric: number;
  switch (scale) {
    case "zero_ten":
      numeric = roundHalfUp(mean, 1);
      value = numeric;
      break;
    case "zero_hundred":
      numeric = roundHalfUp(mean, 0);
      value = numeric;
      break;
    case "concept":
      numeric = roundHalfUp(mean, 1);
      value = conceptFromNumeric(numeric);
      break;
    case "pass_fail":
      numeric = roundHalfUp(mean, 2);
      value = numeric >= 0.5 ? "pass" : "fail";
      break;
  }
  return { value, numeric, count, belowPassing: isBelowPassing(scale, value, passingGrade) };
}

/** Media simples de medias (media da turma = media das medias dos alunos). */
export function averageOfAverages(
  settings: Pick<ModalityAssessmentSettings, "scale" | "passingGrade">,
  averages: readonly (GradeAverage | null)[],
): GradeAverage | null {
  const present = averages.filter((a): a is GradeAverage => a !== null);
  if (present.length === 0) return null;
  // Reusa a media ponderada em cima da escala interna (peso 1 por aluno).
  const { scale } = settings;
  if (scale === "concept") {
    const mean = present.reduce((s, a) => s + a.numeric, 0) / present.length;
    const numeric = roundHalfUp(mean, 1);
    const value = conceptFromNumeric(numeric);
    return { value, numeric, count: present.length, belowPassing: isBelowPassing(scale, value, settings.passingGrade) };
  }
  if (scale === "pass_fail") {
    const mean = present.reduce((s, a) => s + a.numeric, 0) / present.length;
    const numeric = roundHalfUp(mean, 2);
    const value: PassFailGrade = numeric >= 0.5 ? "pass" : "fail";
    return { value, numeric, count: present.length, belowPassing: value !== "pass" };
  }
  const avg = averageGrades(
    settings,
    present.map((a) => ({ status: "graded", value: a.numeric, weight: 1 })),
  );
  return avg ? { ...avg, count: present.length } : null;
}

export interface LevelGrade extends WeightedGrade {
  levelId?: string;
}

/**
 * Medias por etapa da trilha, na ordem de `levelOrder`; notas sem etapa (ou de
 * etapa que saiu da trilha) num grupo final sem `levelId`. So etapas com
 * alguma avaliacao aparecem.
 */
export function averagesByLevel(
  settings: Pick<ModalityAssessmentSettings, "scale" | "passingGrade">,
  items: readonly LevelGrade[],
  levelOrder: readonly string[],
): { levelId?: string; average: GradeAverage | null }[] {
  const known = new Set(levelOrder);
  const groups = new Map<string | undefined, LevelGrade[]>();
  for (const item of items) {
    const key = item.levelId && known.has(item.levelId) ? item.levelId : undefined;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const out: { levelId?: string; average: GradeAverage | null }[] = [];
  for (const levelId of levelOrder) {
    const group = groups.get(levelId);
    if (group) out.push({ levelId, average: averageGrades(settings, group) });
  }
  const loose = groups.get(undefined);
  if (loose) out.push({ average: averageGrades(settings, loose) });
  return out;
}

/** Peso valido: maior que zero, ate 100, no maximo uma casa decimal. */
export function validateWeight(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const n = toNumber(raw);
  if (n === null || n <= 0) return { ok: false, message: "O peso precisa ser maior que zero." };
  if (n > MAX_ASSESSMENT_WEIGHT) return { ok: false, message: `O peso vai até ${MAX_ASSESSMENT_WEIGHT}.` };
  if (roundHalfUp(n, 1) !== n) return { ok: false, message: "Use no máximo uma casa decimal no peso." };
  return { ok: true, value: n };
}

/** Numero em pt-BR com virgula ("7,5", "8"). */
function decimal(n: number, maxDecimals: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

/** Nota para exibir: "7,5", "85", "B", "Apto", "Não apto". */
export function formatGrade(scale: AssessmentScale, value: GradeValue): string {
  switch (scale) {
    case "zero_ten":
      return typeof value === "number" ? decimal(value, 1) : String(value);
    case "zero_hundred":
      return typeof value === "number" ? decimal(value, 0) : String(value);
    case "concept":
      return String(value);
    case "pass_fail":
      return value === "pass" ? "Apto" : "Não apto";
  }
}

/** Media para exibir: "7,5", "B", "75% aptos". */
export function formatAverage(scale: AssessmentScale, average: GradeAverage): string {
  if (scale === "pass_fail") return `${Math.round(average.numeric * 100)}% aptos`;
  return formatGrade(scale, average.value);
}

