"use client";

import type { ClassGroupView } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";
import { useOnboardingSteps } from "@/features/onboarding";
import { TurmasView } from "@/features/turmas";

/**
 * Compoe Turmas com o onboarding (sem uma feature importar a outra): se criar
 * uma turma e o unico passo pendente, a criacao conclui o cadastro basico. Na
 * area de curso ainda falta "Matricular alunos no curso": a criacao so mostra o
 * aviso com "Matricular alunos", e a comemoracao vem na 1a matricula. Turma de
 * mensalidade numa area sem mensalidade (pacote, sem cobranca) traz os passos
 * de regras e planos: tambem nao comemora.
 */
export function ClassesScreen() {
  const { steps, isReady } = useOnboardingSteps();
  const pending = steps.filter((step) => !step.done).map((step) => step.id);
  const onlyClassesPending = isReady && pending.length === 1 && pending[0] === "classes";
  const hasMembershipSteps = steps.some((step) => step.id === "billing");
  const completesSetup = (created: ClassGroupView) =>
    onlyClassesPending && (hasMembershipSteps || classBillingMode(created) !== "membership");
  return <TurmasView createCompletesSetup={completesSetup} />;
}
