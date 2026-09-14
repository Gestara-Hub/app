"use client";

import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="modalities-new"]',
    title: "Cadastre suas modalidades",
    body: "Adicione as modalidades oferecidas (ex.: Judô, Pilates, Dança). As turmas e os professores são organizados a partir delas.",
  },
];

/**
 * Onboarding guiado da tela de Modalidades (primeiro acesso): um passo apontando
 * "Nova modalidade".
 */
export function ModalitiesOnboarding() {
  return (
    <ScreenTour
      id="modalities"
      steps={STEPS}
      permission="classes:manage"
    />
  );
}
