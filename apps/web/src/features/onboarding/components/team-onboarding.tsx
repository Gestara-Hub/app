"use client";

import { useSearchParams } from "next/navigation";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="team-new"]',
    title: "Adicione sua equipe",
    body: "Cadastre os profissionais aqui. Cargo e serviços são opcionais — dá para preencher agora ou depois. Os serviços indicam o que cada um costuma fazer, mas não limitam o agendamento.",
  },
];

/**
 * Onboarding guiado da tela de Equipe (primeiro acesso): um passo apontando o
 * "Novo profissional". Cargo e serviços sao opcionais, entao nao ha
 * pre-requisitos a explicar.
 */
export function TeamOnboarding() {
  // Nao dispara o tour quando a tela abre numa acao dirigida (ex.: deep-link para
  // o CRUD de Cargos, /team?manage=roles) — evita competir com o dialog.
  const directed = useSearchParams().has("manage");
  return (
    <ScreenTour
      id="team"
      steps={STEPS}
      permission="team:manage"
      enabled={!directed}
    />
  );
}
