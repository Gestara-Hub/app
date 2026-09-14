"use client";

import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="classes-new"]',
    title: "Organize suas turmas",
    body: "Crie turmas definindo horários, limites de vagas, professor responsável e dias da semana. É aqui que você matricula alunos e gerencia frequências.",
  },
];

/**
 * Onboarding guiado da tela de Turmas (primeiro acesso): um passo apontando
 * "Nova turma".
 */
export function TurmasOnboarding() {
  return (
    <ScreenTour
      id="classes"
      steps={STEPS}
      permission="classes:manage"
    />
  );
}
