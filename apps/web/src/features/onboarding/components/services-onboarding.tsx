"use client";

import { useSearchParams } from "next/navigation";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="services-categories"]',
    title: "Primeiro, uma categoria",
    body: "Todo serviço pertence a uma categoria — então você precisa de pelo menos uma antes de cadastrar serviços. Crie a primeira aqui em Categorias.",
  },
  {
    target: '[data-tour="services-new"]',
    title: "Depois, o serviço",
    body: "Com a categoria criada, cadastre seu primeiro serviço aqui em Novo serviço.",
  },
];

/**
 * Onboarding guiado da tela de Servicos (primeiro acesso): explica que servico
 * depende de categoria (categoryId obrigatorio) e conduz Categorias -> Novo
 * servico.
 */
export function ServicesOnboarding() {
  // Nao dispara o tour quando a tela abre numa acao dirigida (ex.: deep-link do
  // checklist para o CRUD de Categorias, /services?manage=categories).
  const directed = useSearchParams().has("manage");
  return (
    <ScreenTour
      id="services"
      steps={STEPS}
      permission="services:manage"
      enabled={!directed}
    />
  );
}
