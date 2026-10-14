"use client";

import { useOnboardingSteps } from "@/features/onboarding";
import { TurmaDetailView } from "@/features/turmas";

/**
 * Compoe o detalhe da turma com o onboarding: na area de curso, quando so falta
 * "Matricular alunos no curso", a 1a matricula conclui a configuracao inicial.
 */
export function ClassDetailScreen({ id }: { id: string }) {
  const { steps, isReady } = useOnboardingSteps();
  const pending = steps.filter((step) => !step.done).map((step) => step.id);
  const enrollCompletesSetup = isReady && pending.length === 1 && pending[0] === "enroll";
  return <TurmaDetailView id={id} enrollCompletesSetup={enrollCompletesSetup} />;
}
