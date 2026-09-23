"use client";

import { useOnboardingSteps } from "@/features/onboarding";
import { TurmasView } from "@/features/turmas";

/**
 * Compoe Turmas com o onboarding (sem uma feature importar a outra): se criar
 * uma turma e o unico passo pendente, a criacao conclui o cadastro basico.
 */
export function ClassesScreen() {
  const { steps, isReady } = useOnboardingSteps();
  const pending = steps.filter((step) => !step.done);
  const completesSetup = isReady && pending.length === 1 && pending[0].id === "classes";
  return <TurmasView createCompletesSetup={completesSetup} />;
}
