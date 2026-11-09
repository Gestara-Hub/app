import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * Aula experimental e conversao (09/11/2026, doc product/11 §experimental).
 * Nada e gravado no aluno: tudo sai dos dados que ja existem.
 *
 * - Experimental: aluno cuja primeira participacao foi uma reserva `trial`
 *   (sem matricula, plano ou pacote antes dela). Pode fazer quantas quiser.
 * - Convertido: depois da primeira experimental ganhou matricula em turma,
 *   plano de mensalidade ou pacote de aulas. A primeira dessas e a conversao.
 *   Aula avulsa nao converte (pagou uma aula so).
 * - Quem ja era aluno antes da experimental (ex.: experimentou outra
 *   modalidade) nao conta como experimental.
 */

export type TrialStage = "none" | "trial" | "converted";
export type TrialConversionBy = "enrollment" | "plan" | "package";

export interface TrialSources {
  /** Dias das aulas experimentais reservadas (yyyy-MM-dd). */
  trialDates: string[];
  /** Matriculas em turma (qualquer situacao: a data e o que importa). */
  enrollments: { enrolledAt: string }[];
  /** Pacotes comprados. */
  packages: { purchasedAt: string }[];
  /** Inicio do plano de mensalidade do aluno, quando tem plano. */
  planStartDate?: string;
}

export interface TrialOutcome {
  stage: TrialStage;
  trialCount: number;
  firstTrialAt?: string;
  /** Ultima experimental ja feita (nao conta a marcada para o futuro). */
  lastTrialAt?: string;
  /** Dias desde a ultima experimental feita (0 = hoje). */
  daysSinceTrial?: number;
  convertedAt?: string;
  convertedBy?: TrialConversionBy;
  /** Dias da primeira experimental ate a conversao. */
  daysToConvert?: number;
}

/** Depois de tantos dias sem voltar, o aluno entra no lembrete de chamar de volta. */
export const TRIAL_FOLLOW_UP_DAYS = 7;

const day = (iso: string) => iso.slice(0, 10);
const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));

export function trialOutcome(src: TrialSources, today: string): TrialOutcome {
  const trials = Array.from(new Set(src.trialDates.map(day))).sort();
  if (trials.length === 0) return { stage: "none", trialCount: 0 };
  const firstTrialAt = trials[0];

  const events: { at: string; by: TrialConversionBy }[] = [
    ...src.enrollments.map((e) => ({ at: day(e.enrolledAt), by: "enrollment" as const })),
    ...src.packages.map((p) => ({ at: day(p.purchasedAt), by: "package" as const })),
    ...(src.planStartDate ? [{ at: day(src.planStartDate), by: "plan" as const }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // Ja era aluno antes da primeira experimental: nao e experimental.
  if (events.some((e) => e.at < firstTrialAt)) return { stage: "none", trialCount: trials.length };

  const done = trials.filter((d) => d <= today);
  const lastTrialAt = done.length > 0 ? done[done.length - 1] : undefined;
  const base = {
    trialCount: trials.length,
    firstTrialAt,
    ...(lastTrialAt ? { lastTrialAt, daysSinceTrial: daysBetween(lastTrialAt, today) } : {}),
  };

  const conversion = events.find((e) => e.at >= firstTrialAt);
  if (!conversion) return { stage: "trial", ...base };
  return {
    stage: "converted",
    ...base,
    convertedAt: conversion.at,
    convertedBy: conversion.by,
    daysToConvert: daysBetween(firstTrialAt, conversion.at),
  };
}

/** Experimental sem voltar ha pelo menos `TRIAL_FOLLOW_UP_DAYS` dias: hora de chamar. */
export function needsTrialFollowUp(outcome: TrialOutcome): boolean {
  return outcome.stage === "trial" && (outcome.daysSinceTrial ?? -1) >= TRIAL_FOLLOW_UP_DAYS;
}

/** Texto curto da situacao ("Experimental em 09/11", "Virou aluno em 12/11 (matrícula)"). */
export const TRIAL_CONVERSION_LABEL: Record<TrialConversionBy, string> = {
  enrollment: "matrícula",
  plan: "plano",
  package: "pacote",
};
