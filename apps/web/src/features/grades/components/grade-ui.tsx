"use client";

import type {
  AssessmentGradeStatus,
  AssessmentScale,
  GradeAverage,
  GradeValue,
  Id,
  ModalityAssessmentSettings,
} from "@gestarahub/contracts";
import { formatAverage, formatGrade } from "@gestarahub/core/grades";
import { useCan, useCurrentUser } from "@/features/auth";
import { cn } from "@/lib/utils";

/** Rotulo da escala no editor da modalidade e nos resumos. */
export const SCALE_LABEL: Record<AssessmentScale, string> = {
  zero_ten: "0 a 10",
  zero_hundred: "0 a 100",
  concept: "A a E",
  pass_fail: "Apto ou não",
};

/** "Mínima 6", "Mínima C", "Mínima: apto". */
export function passingLabel(settings: ModalityAssessmentSettings): string {
  if (settings.scale === "pass_fail") return "Mínima: apto";
  return `Mínima ${formatGrade(settings.scale, settings.passingGrade)}`;
}

/**
 * Pode lancar notas nesta turma? `grades:manage` e, no professor, so na turma
 * em que e o instrutor titular (o service aplica a mesma regra).
 */
export function useCanManageGrades(instructorId: Id | undefined): boolean {
  const can = useCan();
  const user = useCurrentUser();
  if (!can("grades:manage")) return false;
  if (user.profile !== "professional") return true;
  return Boolean(user.professionalId) && user.professionalId === instructorId;
}

const BELOW = "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400";
const NEUTRAL = "border-border bg-muted/40 text-foreground";

/** Nota ou media em etiqueta; vermelha abaixo da minima. */
export function GradePill({
  label,
  below,
  className,
}: {
  label: string;
  below?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        below ? BELOW : NEUTRAL,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AverageValue({
  scale,
  average,
  className,
}: {
  scale: AssessmentScale;
  average: GradeAverage | null;
  className?: string;
}) {
  if (!average) return <span className={cn("text-xs text-muted-foreground", className)}>sem nota</span>;
  return <GradePill label={formatAverage(scale, average)} below={average.belowPassing} className={className} />;
}

/** Nota lancada, "Faltou" ou "Sem nota". */
export function GradeStatusValue({
  scale,
  status,
  value,
  below,
}: {
  scale: AssessmentScale;
  status: AssessmentGradeStatus;
  value?: GradeValue;
  below?: boolean;
}) {
  if (status === "absent") return <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Faltou</span>;
  if (status === "none" || value === undefined) return <span className="text-xs text-muted-foreground">Sem nota</span>;
  return <GradePill label={formatGrade(scale, value)} below={below} />;
}

/** "Peso 1", "Peso 1,5". */
export function weightLabel(weight: number): string {
  return `Peso ${weight.toLocaleString("pt-BR")}`;
}
