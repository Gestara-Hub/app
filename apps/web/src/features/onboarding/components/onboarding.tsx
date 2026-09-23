"use client";

import { useState } from "react";
import { useCurrentUser } from "@/features/auth";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";
import { ProductTour, type TourStep } from "./product-tour";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

// Passos do tour para agendamento individual (Barbearia, Clínica, etc.)
const TOUR_STEPS_DEFAULT: TourStep[] = [
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

// Passos do tour para turmas e aulas coletivas (Escola de Idiomas, Cursos, Academia, etc.)
const TOUR_STEPS_CLASSES: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: "O menu ao lado",
    body: "É por aqui que você anda no dia a dia: alunos, equipe, modalidades, turmas e mensalidades ficam todos neste menu.",
  },
  {
    target: '[data-tour="nav-classes"]',
    title: "Turmas",
    body: "Aqui você organiza as turmas, horários das aulas, limites de vagas e matrículas.",
  },
  {
    target: '[data-tour="nav-users"]',
    title: "Usuários",
    body: "Cadastre quem vai usar o GestaraHub e defina o que cada pessoa pode ver e fazer.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Configurações",
    body: "Aqui você ajusta o horário de funcionamento, regras de cobrança das mensalidades e outras opções do seu negócio.",
  },
  {
    target: '[data-tour="onboarding-checklist"]',
    title: "Primeiros passos",
    body: "Siga esta lista para deixar tudo pronto. Cada item te leva direto ao lugar certo — alguns só abrem depois que você cadastra o que vem antes.",
  },
];

/**
 * Orquestra o onboarding (modal de boas-vindas + tour + checklist). Montado no
 * Dashboard; so aparece para o Proprietario enquanto a conta nao esta
 * configurada. `isReady` (todas as leituras resolvidas) tambem serve de guarda
 * de SSR/hidratacao — servidor e 1o render do cliente devolvem null igualmente.
 */
export function Onboarding() {
  const user = useCurrentUser();
  const [state, update] = useOnboardingState();
  const { steps, doneCount, total, isReady, isComplete, isClasses } =
    useOnboardingSteps();
  const [tourOpen, setTourOpen] = useState(false);

  if (!isReady || user.profile !== "owner") return null;

  // Estado derivado (sem efeito): abre as boas-vindas ate serem respondidas.
  // Qualquer acao de fechar grava `seen`, o que fecha o modal naturalmente.
  const welcomeOpen = !state.seen && !isComplete;
  const showChecklist = !isComplete;

  return (
    <>
      {showChecklist ? (
        <OnboardingChecklist
          steps={steps}
          doneCount={doneCount}
          total={total}
          isClasses={isClasses}
          // O Dashboard nunca e a tela de um passo: o "Continuar" pulsa (menos no tour).
          highlightNextStep={!tourOpen}
          onStartTour={() => setTourOpen(true)}
        />
      ) : null}

      <OnboardingWelcomeDialog
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (!open) update({ seen: true });
        }}
        onStartTour={() => {
          update({ seen: true });
          setTourOpen(true);
        }}
        onStartSetup={() => update({ seen: true })}
      />

      {tourOpen ? (
        <ProductTour
          steps={isClasses ? TOUR_STEPS_CLASSES : TOUR_STEPS_DEFAULT}
          onClose={() => setTourOpen(false)}
        />
      ) : null}
    </>
  );
}
