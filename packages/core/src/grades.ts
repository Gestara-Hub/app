import type {
  AssessmentGradeStatus,
  AssessmentResultMode,
  AssessmentScale,
  ConceptGrade,
  GradeAverage,
  GradeValue,
  ModalityAssessmentSettings,
  PassFailGrade,
} from "@gestarahub/contracts";
import { parseDecimal } from "@gestarahub/core/format";

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
 *
 * Fase A de 31/10/2026: soma dos pontos (cada avaliacao vale uma parte do
 * total da escala; o resultado e o total, ate o topo), recuperacao (vale a
 * maior nota) e frequencia minima (no boletim).
 */

export const ASSESSMENT_SCALES: readonly AssessmentScale[] = ["zero_ten", "zero_hundred", "concept", "pass_fail"];
export const ASSESSMENT_RESULT_MODES: readonly AssessmentResultMode[] = ["average", "sum"];
export const CONCEPT_GRADES: readonly ConceptGrade[] = ["A", "B", "C", "D", "E"];
export const DEFAULT_ASSESSMENT_SCALE: AssessmentScale = "zero_ten";
export const DEFAULT_ASSESSMENT_WEIGHT = 1;
export const MAX_ASSESSMENT_WEIGHT = 100;
export const MAX_ASSESSMENT_NAME_LENGTH = 80;

const CONCEPT_POINTS: Record<ConceptGrade, number> = { A: 10, B: 8, C: 6, D: 4, E: 2 };

/** Topo da escala numerica (10 ou 100); conceito e apto nao tem. */
export function scaleMax(scale: AssessmentScale): number | undefined {
  return scale === "zero_ten" ? 10 : scale === "zero_hundred" ? 100 : undefined;
}

/** Soma dos pontos ligada (so vale nas escalas numericas). */
export function usesPointsSum(settings: Pick<ModalityAssessmentSettings, "scale" | "resultMode">): boolean {
  return settings.resultMode === "sum" && scaleMax(settings.scale) !== undefined;
}

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

/**
 * Arredonda metade para cima em `decimals` casas, sem erro de ponto flutuante.
 * Revisao geral de 31/10/2026 (achado V4): somar `Number.EPSILON` nao bastava
 * (5,95 virava 5,9 e reprovava); agora o produto e limpo em 12 digitos antes.
 */
export function roundHalfUp(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(Number((value * factor).toPrecision(12))) / factor;
}

export type GradeCheck = { ok: true; value: GradeValue } | { ok: false; message: string };


/**
 * Valida e normaliza uma nota na escala. Aceita numero ou texto ("7,5", "7.5",
 * "b", "apto"). 0 a 10: uma casa decimal; 0 a 100: inteiro; conceito: A a E;
 * apto/nao apto: `pass`/`fail`. `max`: na soma dos pontos, quanto a avaliacao
 * vale (a nota vai de 0 a ele).
 */
export function normalizeGrade(scale: AssessmentScale, raw: unknown, max?: number): GradeCheck {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: false, message: "Informe a nota." };
  }
  switch (scale) {
    case "zero_ten": {
      const top = max ?? 10;
      const n = parseDecimal(raw);
      if (n === null || n < 0 || n > top) return { ok: false, message: `A nota vai de 0 a ${decimal(top, 1)}.` };
      if (roundHalfUp(n, 1) !== n) return { ok: false, message: "Use no máximo uma casa decimal." };
      return { ok: true, value: n };
    }
    case "zero_hundred": {
      const top = max ?? 100;
      const n = parseDecimal(raw);
      if (n === null || n < 0 || n > top) return { ok: false, message: `A nota vai de 0 a ${decimal(top, 0)}.` };
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

/** Nota com o que a avaliacao vale na soma dos pontos. */
export interface ResultItem extends WeightedGrade {
  points?: number;
}

type ResultSettings = Pick<ModalityAssessmentSettings, "scale" | "passingGrade" | "resultMode">;

/**
 * Nota abaixo da minima nesta avaliacao. Na soma, proporcional ao que ela vale
 * (2 de 3 pontos com minima 6 de 10 fica acima).
 */
export function isGradeBelowPassing(settings: ResultSettings, value: GradeValue, points?: number): boolean {
  const top = scaleMax(settings.scale);
  if (usesPointsSum(settings) && top && points && typeof value === "number" && typeof settings.passingGrade === "number") {
    return value / points < settings.passingGrade / top;
  }
  return isBelowPassing(settings.scale, value, settings.passingGrade);
}

/**
 * Total na soma dos pontos: as notas somadas (ate o topo da escala). Faltou
 * conta nos pontos dados (vale zero). O vermelho segue o ritmo: o total contra
 * os pontos ja dados.
 */
function sumResult(settings: ResultSettings, items: readonly ResultItem[]): GradeAverage | null {
  const top = scaleMax(settings.scale) as number;
  let total = 0;
  let outOf = 0;
  let count = 0;
  for (const item of items) {
    if (item.status === "graded" && typeof item.value === "number") {
      total += item.value;
      outOf += item.points ?? 0;
      count += 1;
    } else if (item.status === "absent") {
      outOf += item.points ?? 0;
    }
  }
  if (count === 0) return null;
  const decimals = settings.scale === "zero_ten" ? 1 : 0;
  const numeric = roundHalfUp(Math.min(total, top), decimals);
  const passing = typeof settings.passingGrade === "number" ? settings.passingGrade : 0;
  const belowPassing = outOf > 0 ? numeric / Math.min(outOf, top) < passing / top : numeric < passing;
  return { value: numeric, numeric, count, belowPassing, outOf: roundHalfUp(Math.min(outOf, top), decimals) };
}

/** Resultado do aluno: media com pesos ou, na soma dos pontos, o total. */
export function resultOf(settings: ResultSettings, items: readonly ResultItem[]): GradeAverage | null {
  return usesPointsSum(settings) ? sumResult(settings, items) : averageGrades(settings, items);
}

/** Media de uma avaliacao (peso 1 por aluno); na soma, o vermelho e proporcional ao que ela vale. */
export function assessmentAverage(
  settings: ResultSettings,
  items: readonly Pick<WeightedGrade, "status" | "value">[],
  points?: number,
): GradeAverage | null {
  const avg = averageGrades(settings, items.map((i) => ({ ...i, weight: 1 })));
  if (!avg || !usesPointsSum(settings) || !points) return avg;
  return { ...avg, belowPassing: isGradeBelowPassing(settings, avg.numeric, points), outOf: points };
}

/**
 * Nota que vale com a recuperacao: a maior das duas; sem nota na original
 * (faltou), vale a da recuperacao (segunda chamada).
 */
export function withRecovery(
  scale: AssessmentScale,
  original: Pick<WeightedGrade, "status" | "value">,
  recovery: Pick<WeightedGrade, "status" | "value"> | undefined,
): { status: AssessmentGradeStatus; value?: GradeValue; recovered: boolean } {
  if (!recovery || recovery.status !== "graded" || recovery.value === undefined) return { ...original, recovered: false };
  if (original.status !== "graded" || original.value === undefined) {
    return { status: "graded", value: recovery.value, recovered: true };
  }
  return gradeToNumeric(scale, recovery.value) > gradeToNumeric(scale, original.value)
    ? { status: "graded", value: recovery.value, recovered: true }
    : { ...original, recovered: false };
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
  settings: ResultSettings,
  averages: readonly (GradeAverage | null)[],
): GradeAverage | null {
  const present = averages.filter((a): a is GradeAverage => a !== null);
  if (present.length === 0) return null;
  if (usesPointsSum(settings)) {
    // Total medio da turma, com o vermelho pelo ritmo medio (pontos dados em media).
    const top = scaleMax(settings.scale) as number;
    const decimals = settings.scale === "zero_ten" ? 1 : 0;
    const numeric = roundHalfUp(present.reduce((s, a) => s + a.numeric, 0) / present.length, decimals);
    const outOf = roundHalfUp(present.reduce((s, a) => s + (a.outOf ?? top), 0) / present.length, decimals);
    const passing = typeof settings.passingGrade === "number" ? settings.passingGrade : 0;
    return { value: numeric, numeric, count: present.length, belowPassing: outOf > 0 && numeric / outOf < passing / top, outOf };
  }
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

export interface LevelGrade extends ResultItem {
  levelId?: string;
}

/**
 * Medias por etapa da trilha, na ordem de `levelOrder`; notas sem etapa (ou de
 * etapa que saiu da trilha) num grupo final sem `levelId`. So etapas com
 * alguma avaliacao aparecem.
 */
export function averagesByLevel(
  settings: ResultSettings,
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
    if (group) out.push({ levelId, average: resultOf(settings, group) });
  }
  const loose = groups.get(undefined);
  if (loose) out.push({ average: resultOf(settings, loose) });
  return out;
}

/** Peso valido: maior que zero, ate 100, no maximo uma casa decimal. */
export function validateWeight(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const n = parseDecimal(raw);
  if (n === null || n <= 0) return { ok: false, message: "O peso precisa ser maior que zero." };
  if (n > MAX_ASSESSMENT_WEIGHT) return { ok: false, message: `O peso vai até ${MAX_ASSESSMENT_WEIGHT}.` };
  if (roundHalfUp(n, 1) !== n) return { ok: false, message: "Use no máximo uma casa decimal no peso." };
  return { ok: true, value: n };
}

/**
 * Quanto a avaliacao vale na soma dos pontos: maior que zero, ate o topo da
 * escala; uma casa decimal no 0 a 10, inteiro no 0 a 100.
 */
export function validatePoints(scale: AssessmentScale, raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const top = scaleMax(scale) ?? 100;
  const n = parseDecimal(raw);
  if (n === null || n <= 0) return { ok: false, message: "Informe quanto a avaliação vale." };
  if (n > top) return { ok: false, message: `Vale no máximo ${decimal(top, 1)} pontos.` };
  const decimals = scale === "zero_ten" ? 1 : 0;
  if (roundHalfUp(n, decimals) !== n) {
    return { ok: false, message: decimals === 1 ? "Use no máximo uma casa decimal." : "Use um número inteiro." };
  }
  return { ok: true, value: n };
}

/** Frequencia minima valida: inteiro de 1 a 100 (%). */
export function validateMinAttendance(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const n = parseDecimal(raw);
  if (n === null || !Number.isInteger(n) || n < 1 || n > 100) {
    return { ok: false, message: "Use um número inteiro de 1 a 100." };
  }
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

