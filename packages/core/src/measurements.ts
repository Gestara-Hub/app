import type { MeasureProgress, ModalityMeasure, StudentMeasurement } from "@gestarahub/contracts";
import { parseDecimal } from "@gestarahub/core/format";

/**
 * Testes e medidas dos alunos (doc 21 §2.4, fase B de 31/10/2026): validacao
 * dos valores e da lista de medidas da modalidade, evolucao (ultima, anterior,
 * primeira e se melhorou pela direcao da medida) e o formato em pt-BR. O
 * servico so guarda e chama estas funcoes, como nas notas.
 */

export const MAX_MEASURES = 20;
export const MAX_MEASURE_NAME_LENGTH = 40;
export const MAX_MEASURE_UNIT_LENGTH = 10;
export const MAX_MEASUREMENT_NOTES_LENGTH = 500;
const MAX_ABS_VALUE = 100_000;

export type MeasureCheck<T> = { ok: true; value: T } | { ok: false; message: string };


/** Valor de uma medida: numero com ate duas casas decimais (pode ser negativo, como no alcance). */
export function normalizeMeasureValue(raw: unknown): MeasureCheck<number> {
  const n = parseDecimal(raw);
  if (n === null) return { ok: false, message: "Use um número, como 12,5." };
  if (Math.abs(n) > MAX_ABS_VALUE) return { ok: false, message: "Número grande demais." };
  if (Math.round(n * 100) / 100 !== n) return { ok: false, message: "Use no máximo duas casas decimais." };
  return { ok: true, value: n };
}

/**
 * Lista de medidas da modalidade: nome obrigatorio e sem repetir, unidade
 * opcional e curta, direcao valida, no maximo 20. Devolve a lista limpa.
 */
export function validateMeasures(list: readonly ModalityMeasure[]): MeasureCheck<ModalityMeasure[]> {
  if (list.length > MAX_MEASURES) return { ok: false, message: `Use até ${MAX_MEASURES} medidas.` };
  const seen = new Set<string>();
  const out: ModalityMeasure[] = [];
  for (const m of list) {
    const name = m.name.trim();
    const unit = m.unit.trim();
    if (!name) return { ok: false, message: "Dê um nome a cada medida." };
    if (name.length > MAX_MEASURE_NAME_LENGTH) {
      return { ok: false, message: `Use até ${MAX_MEASURE_NAME_LENGTH} caracteres no nome.` };
    }
    if (unit.length > MAX_MEASURE_UNIT_LENGTH) {
      return { ok: false, message: `Use até ${MAX_MEASURE_UNIT_LENGTH} caracteres na unidade.` };
    }
    if (m.better !== "higher" && m.better !== "lower") return { ok: false, message: "Escolha se é melhor subir ou descer." };
    const key = name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return { ok: false, message: `A medida ${name} aparece duas vezes.` };
    seen.add(key);
    out.push({ id: m.id, name, unit, better: m.better });
  }
  return { ok: true, value: out };
}

/** Avaliacoes em ordem de data (a mais antiga primeiro; no mesmo dia, a registrada antes). */
function chronological(history: readonly StudentMeasurement[]): StudentMeasurement[] {
  return [...history].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Evolucao de cada medida: a ultima, a anterior e a primeira com valor, e a
 * mudanca da anterior para a ultima, boa ou ruim pela direcao da medida.
 */
export function measureProgress(
  measures: readonly ModalityMeasure[],
  history: readonly StudentMeasurement[],
): MeasureProgress[] {
  const ordered = chronological(history);
  return measures.map((measure) => {
    const points = ordered
      .filter((h) => typeof h.values[measure.id] === "number")
      .map((h) => ({ value: h.values[measure.id], date: h.date }));
    const latest = points.at(-1);
    const previous = points.length > 1 ? points.at(-2) : undefined;
    const first = points[0];
    const change = latest && previous ? Math.round((latest.value - previous.value) * 100) / 100 : null;
    const improved = change === null || change === 0 ? null : measure.better === "higher" ? change > 0 : change < 0;
    return {
      measure,
      ...(latest ? { latest } : {}),
      ...(previous ? { previous } : {}),
      ...(first ? { first } : {}),
      change,
      improved,
    };
  });
}

function decimal(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** "12,5 kg", "45 s", "18%", "7" (sem unidade). */
export function formatMeasureValue(value: number, unit: string): string {
  const text = decimal(value);
  if (!unit) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

/** "+2,5 kg", "−1 s", "0 s". */
export function formatMeasureChange(change: number, unit: string): string {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${formatMeasureValue(Math.abs(change), unit)}`;
}
