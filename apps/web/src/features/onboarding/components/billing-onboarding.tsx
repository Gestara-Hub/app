"use client";

import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="billing-generate"]',
    title: "Gerencie as mensalidades",
    body: "Gere as cobranças da competência com um clique para os alunos matriculados e acompanhe os pagamentos, pendências e atrasos.",
  },
];

/**
 * Onboarding guiado da tela de Mensalidades (primeiro acesso): um passo apontando
 * "Gerar cobranças".
 */
export function BillingOnboarding() {
  return (
    <ScreenTour
      id="billing"
      steps={STEPS}
      permission="billing:manage"
    />
  );
}
