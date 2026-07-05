"use client";

import { useSearchParams } from "next/navigation";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS: TourStep[] = [
  {
    target: '[data-tour="services-new"]',
    title: "Cadastre seus serviços",
    body: "Adicione o que o seu negócio oferece aqui. Categoria é opcional — serve só para organizar o catálogo; dá para deixar sem e definir depois.",
  },
];

/**
 * Onboarding guiado da tela de Servicos (primeiro acesso): um passo apontando o
 * "Novo serviço". Categoria e opcional, entao nao ha pre-requisito a explicar.
 */
export function ServicesOnboarding() {
  // Nao dispara o tour quando a tela abre numa acao dirigida (ex.: deep-link para
  // o CRUD de Categorias, /services?manage=categories).
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
