"use client";

import { useOnboardingSteps } from "@/features/onboarding";
import { TurmasView } from "@/features/turmas";

/**
 * Compoe Turmas com o onboarding (sem uma feature importar a outra): se criar
 * uma turma e o unico passo pendente, a criacao conclui o cadastro basico. Na
 * area de curso ainda falta "Matricular alunos no curso": a criacao so mostra o
 * aviso com "Matricular alunos", e a comemoracao vem na 1a matricula.
 */
export function ClassesScreen() {
  const { steps, isReady } = useOnboardingSteps();
  const pending = steps.filter((step) => !step.done).map((step) => step.id);
  const completesSetup = isReady && pending.length === 1 && pending[0] === "classes";
  return <TurmasView createCompletesSetup={completesSetup} />;
}
