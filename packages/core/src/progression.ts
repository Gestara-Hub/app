import type { ProgressionCriteriaType, StudentStageGrades } from "@gestarahub/contracts";
import { formatGrade, scaleMax, usesPointsSum } from "@gestarahub/core/grades";

/**
 * "Apto" a graduar numa regra so (doc product/30 §1, 13/11/2026), usada no
 * Graduar individual, no lote da turma, no atalho do evento e no Painel.
 *
 * - Criterio da trilha: aulas, tempo ou os dois desde a ultima graduacao.
 * - Com avaliacoes ligadas na modalidade: tambem a media (ou o total) da etapa
 *   atual na minima e a frequencia na minima, quando a modalidade exige.
 * - Trilha por prova (`manual_exam`): sem avaliacoes, quem decide e o
 *   professor (nunca "Apto"); com avaliacoes, valem so as notas e a frequencia.
 *
 * O selo orienta e nao bloqueia: quem nao esta apto pode ser graduado com
 * confirmacao (decisao 3 do doc 30).
 */

export interface PromotionReadinessInput {
  criteriaType: ProgressionCriteriaType;
  targetAttendances: number;
  targetMonths: number;
  /** Aulas desde a ultima graduacao (com o ponto de partida). */
  presentSincePromotion: number;
  monthsInLevel: number;
  /** Ha proximo passo na trilha (grau ou nivel). No ultimo nivel, nunca apto. */
  hasNextStep: boolean;
  grades?: StudentStageGrades;
  /** "neste nível", "nesta faixa": completa o "Sem nota". */
  inLevel?: string;
}

export interface PromotionReadiness {
  ready: boolean;
  /** O que falta, uma frase curta cada: "Faltam 6 aulas", "Média 5,8, mínima 6". */
  gaps: string[];
}

/** Linha das notas na tela: "Média" "7,5" "mínima 6", certo ou nao. */
export interface StageGradeCheck {
  key: "grade" | "attendance";
  label: string;
  value: string;
  target?: string;
  ok: boolean;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `Falta 1 ${one}` : `Faltam ${n} ${many}`;
}

/** Media e frequencia da etapa, para mostrar e para o "Apto". */
export function stageGradeChecks(grades: StudentStageGrades): StageGradeCheck[] {
  const { settings, average, attendancePercent } = grades;
  const { scale, passingGrade } = settings;
  const sum = usesPointsSum(settings);
  const checks: StageGradeCheck[] = [];

  if (scale === "pass_fail") {
    checks.push({
      key: "grade",
      label: "Avaliações",
      value: average ? (average.belowPassing ? "Não apto" : "Apto") : "Sem nota",
      ok: Boolean(average && !average.belowPassing),
    });
  } else {
    const passing = formatGrade(scale, passingGrade);
    checks.push({
      key: "grade",
      label: sum ? "Total" : "Média",
      value: average
        ? sum
          ? `${formatGrade(scale, average.value)} de ${formatGrade(scale, average.outOf ?? scaleMax(scale) ?? 0)}`
          : formatGrade(scale, average.value)
        : "Sem nota",
      target: sum ? `mínimo ${passing} de ${scaleMax(scale)}` : `mínima ${passing}`,
      ok: Boolean(average && !average.belowPassing),
    });
  }

  const min = settings.minAttendancePercent;
  if (min) {
    checks.push({
      key: "attendance",
      label: "Frequência",
      value: attendancePercent === null ? "Sem chamada" : `${attendancePercent}%`,
      target: `mínima ${min}%`,
      // Sem chamada nao reprova (igual ao boletim).
      ok: attendancePercent === null || attendancePercent >= min,
    });
  }
  return checks;
}

export function promotionReadiness(input: PromotionReadinessInput): PromotionReadiness {
  const gaps: string[] = [];
  const { criteriaType, grades } = input;

  const byAttendance = criteriaType === "attendance" || criteriaType === "attendance_and_time";
  const byTime = criteriaType === "time" || criteriaType === "attendance_and_time";
  if (byAttendance && input.presentSincePromotion < input.targetAttendances) {
    gaps.push(plural(input.targetAttendances - input.presentSincePromotion, "aula", "aulas"));
  }
  if (byTime && input.monthsInLevel < input.targetMonths) {
    gaps.push(plural(input.targetMonths - input.monthsInLevel, "mês", "meses"));
  }

  if (grades) {
    for (const check of stageGradeChecks(grades)) {
      if (check.ok) continue;
      if (check.key === "grade" && !grades.average) {
        gaps.push(`Sem nota ${input.inLevel ?? "nesta etapa"}`);
      } else {
        gaps.push(check.target ? `${check.label} ${check.value}, ${check.target}` : `${check.label}: ${check.value}`);
      }
    }
  }

  // Por prova e sem notas no sistema: o professor decide, sem selo.
  const decidedByTeacher = criteriaType === "manual_exam" && !grades;
  return { ready: input.hasNextStep && !decidedByTeacher && gaps.length === 0, gaps };
}
