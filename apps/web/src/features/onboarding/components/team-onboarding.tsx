"use client";

import { useSearchParams } from "next/navigation";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-services"]',
    title: "Antes, os serviços",
    body: "Cada profissional realiza serviços — então cadastre seus serviços antes, em Serviços. Sem nenhum, não dá para concluir o cadastro do profissional.",
  },
  {
    target: '[data-tour="team-roles"]',
    title: "E os cargos",
    body: "Todo profissional tem um cargo. No cadastro você escolhe um cargo que já existe (não dá para criar ali), então cadastre os cargos aqui em Cargos antes.",
  },
  {
    target: '[data-tour="team-new"]',
    title: "Novo profissional",
    body: "Com serviços e cargos cadastrados, crie o profissional: cargo, os serviços que ele realiza e a disponibilidade na agenda.",
  },
];

/**
 * Onboarding guiado da tela de Equipe (primeiro acesso): explica que profissional
 * depende de servicos (serviceIds obrigatorio) e conduz Serviços -> Cargos
 * (opcional) -> Novo profissional.
 */
export function TeamOnboarding() {
  // Nao dispara o tour quando a tela abre numa acao dirigida (ex.: deep-link do
  // checklist para o CRUD de Cargos, /team?manage=roles) — evita competir com o
  // dialog que abre por cima.
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
