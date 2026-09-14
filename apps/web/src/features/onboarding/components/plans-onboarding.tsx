"use client";

import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="plans-new"]',
    title: "Cadastre seus planos",
    body: "Crie planos de mensalidade (mensal, trimestral, etc.) com seus respectivos valores para vincular às matrículas dos alunos.",
  },
];

/**
 * Onboarding guiado da tela de Planos (primeiro acesso): um passo apontando
 * "Novo plano".
 */
export function PlansOnboarding() {
  return (
    <ScreenTour
      id="plans"
      steps={STEPS}
      permission="billing:manage"
    />
  );
}
