"use client";

import { useSearchParams } from "next/navigation";
import { useModel } from "@/features/auth";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS_DEFAULT: TourStep[] = [
  {
    target: '[data-tour="team-new"]',
    title: "Adicione sua equipe",
    body: "Cadastre os profissionais aqui. Cargo e serviços são opcionais — dá para preencher agora ou depois. Os serviços indicam o que cada um costuma fazer, mas não limitam o agendamento.",
  },
];

const STEPS_CLASSES: TourStep[] = [
  {
    target: '[data-tour="team-new"]',
    title: "Adicione seus instrutores",
    body: "Cadastre os professores e instrutores aqui. As modalidades lecionadas indicam quais aulas cada professor costuma ministrar.",
  },
];

/**
 * Onboarding guiado da tela de Equipe (primeiro acesso): um passo apontando o
 * "Novo profissional". Cargo e serviços/modalidades sao opcionais.
 */
export function TeamOnboarding() {
  const isClasses = useModel() === "classes";
  // Nao dispara o tour quando a tela abre numa acao dirigida (ex.: deep-link para
  // o CRUD de Cargos, /team?manage=roles) — evita competir com o dialog.
  const directed = useSearchParams().has("manage");
  return (
    <ScreenTour
      id="team"
      steps={isClasses ? STEPS_CLASSES : STEPS_DEFAULT}
      permission="team:manage"
      enabled={!directed}
    />
  );
}
