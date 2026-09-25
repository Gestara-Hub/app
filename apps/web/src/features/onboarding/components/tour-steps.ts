import type { TourStep } from "./product-tour";

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
    body: "É aqui que você marca e acompanha os agendamentos — por dia, semana ou mês.",
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
    body: "Siga esta lista para deixar tudo pronto. Cada item te leva direto ao lugar certo — alguns só abrem depois que você cadastra o que vem antes.",
  },
];

/** Passos do tour para turmas e aulas coletivas (Escola de Idiomas, Cursos, Academia, etc.) */
export const TOUR_STEPS_CLASSES: TourStep[] = [
  {
    target: '[data-tour="nav-group-operations"]',
    title: "Operação Diária",
    body: "Calendário, Turmas e Alunos ficam juntos no topo e a 1 clique de distância para o atendimento rápido na recepção e lista de chamada.",
  },
  {
    target: '[data-tour="nav-group-financial"]',
    title: "Financeiro",
    body: "Aqui você acompanha as mensalidades geradas, registra baixas de pagamento e controla quem está em dia ou pendente.",
  },
  {
    target: '[data-tour="nav-group-catalog"]',
    title: "Cadastros da Academia",
    body: "Modalidades, Planos e Equipe ficam organizados nesta seção — você estrutura no início e altera quando precisar.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Configurações",
    body: "No rodapé você ajusta o horário de funcionamento, regras padrão de cobrança e permissões de usuários.",
  },
  {
    target: '[data-tour="onboarding-checklist"]',
    title: "Primeiros passos",
    body: "Siga esta lista para deixar tudo pronto. Cada item te leva direto ao lugar certo — alguns só abrem depois que você cadastra o que vem antes.",
  },
];
