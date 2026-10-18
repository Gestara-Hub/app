import type { ClassBillingMode } from "@gestarahub/contracts";
import type { TourStep } from "@/components/shared/product-tour";

/** Passos do tour para agendamento individual (Barbearia, Clínica, etc.) */
export const TOUR_STEPS_DEFAULT: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: "O menu ao lado",
    body: "É por aqui que você anda no dia a dia: clientes, equipe, serviços e agenda ficam todos neste menu.",
  },
  {
    target: '[data-tour="nav-agenda"]',
    title: "Agenda",
    body: "Marque e acompanhe os agendamentos por dia, semana ou mês.",
  },
  {
    target: '[data-tour="nav-users"]',
    title: "Usuários",
    body: "Cadastre quem vai usar o GestaraHub e defina o que cada pessoa pode ver e fazer.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Configurações",
    body: "Aqui você ajusta o horário de funcionamento e outras opções do seu negócio.",
  },
  {
    target: '[data-tour="onboarding-checklist"]',
    title: "Primeiros passos",
    body: "Siga a lista: cada item leva ao lugar certo.",
  },
];

/**
 * Passos do tour para turmas e aulas (doc 08): uma frase curta por passo, e o
 * passo de Configuracoes so cita as regras da mensalidade em area que cobra
 * mensalidade.
 */
export function tourStepsForClasses(billingMode: ClassBillingMode): TourStep[] {
  return [
    {
      target: '[data-tour="nav-group-operations"]',
      title: "Operação diária",
      body: "Calendário, turmas, alunos e mensagens do dia.",
    },
    {
      target: '[data-tour="nav-group-financial"]',
      title: "Financeiro",
      body: "Cobranças, pagamentos e quem está em dia.",
    },
    {
      target: '[data-tour="nav-group-catalog"]',
      title: "Cadastros",
      body: "Modalidades, planos e pacotes, e a equipe.",
    },
    {
      target: '[data-tour="nav-settings"]',
      title: "Configurações",
      body:
        billingMode === "membership"
          ? "Horários, regras da mensalidade e usuários."
          : "Horários de funcionamento e usuários.",
    },
    {
      target: '[data-tour="onboarding-checklist"]',
      title: "Primeiros passos",
      body: "Siga a lista: cada item leva ao lugar certo.",
    },
  ];
}
