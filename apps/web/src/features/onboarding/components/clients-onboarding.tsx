"use client";

import { useModel } from "@/features/auth";
import type { TourStep } from "./product-tour";
import { ScreenTour } from "./screen-tour";

const STEPS_DEFAULT: TourStep[] = [
  {
    target: '[data-tour="clients-new"]',
    title: "Cadastre seus clientes",
    body: "Adicione os clientes que frequentam o seu negócio para agendar atendimentos e manter o histórico organizado.",
  },
];

const STEPS_CLASSES: TourStep[] = [
  {
    target: '[data-tour="clients-new"]',
    title: "Cadastre seus alunos",
    body: "Adicione os alunos aqui. Você poderá matriculá-los nas turmas, registrar frequências e acompanhar as mensalidades.",
  },
];

/**
 * Onboarding guiado da tela de Clientes (primeiro acesso): um passo apontando o
 * "Novo cliente". Mensagens adaptadas para atendimento individual vs turmas/alunos.
 */
export function ClientsOnboarding() {
  const isClasses = useModel() === "classes";
  return (
    <ScreenTour
      id="clients"
      steps={isClasses ? STEPS_CLASSES : STEPS_DEFAULT}
      permission="clients:manage"
    />
  );
}
