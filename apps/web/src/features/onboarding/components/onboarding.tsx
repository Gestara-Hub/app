"use client";

import { useState } from "react";
import { useCurrentUser } from "@/features/auth";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";
import { ProductTour, type TourStep } from "./product-tour";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

// Passos do tour: alvos estaveis do app shell (sidebar) + o checklist no
// Dashboard. Alvos ausentes sao ignorados pelo motor (cai para balao central).
const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: "Sua navegação",
    body: "Todos os módulos do sistema ficam aqui na lateral — é por onde você circula.",
  },
  {
    target: '[data-tour="nav-agenda"]',
    title: "Agenda",
    body: "O coração do sistema: crie e acompanhe os agendamentos por dia, semana e mês.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Configurações",
    body: "Ajuste o horário de funcionamento e as preferências do negócio por aqui.",
  },
  {
    target: '[data-tour="onboarding-checklist"]',
    title: "Primeiros passos",
    body: "Siga estes cards para deixar tudo pronto. Cada um leva direto à tela — e alguns só liberam após os pré-cadastros.",
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
  const { steps, doneCount, total, isReady, isComplete } = useOnboardingSteps();
  const [tourOpen, setTourOpen] = useState(false);

  if (!isReady || user.profile !== "owner") return null;

  // Estado derivado (sem efeito): abre as boas-vindas ate serem respondidas.
  // Qualquer acao de fechar grava `seen`, o que fecha o modal naturalmente.
  const welcomeOpen = !state.seen && !isComplete;
  const showChecklist = !state.dismissed && !isComplete;

  return (
    <>
      {showChecklist ? (
        <OnboardingChecklist
          steps={steps}
          doneCount={doneCount}
          total={total}
          onDismiss={() => update({ dismissed: true })}
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
        <ProductTour steps={TOUR_STEPS} onClose={() => setTourOpen(false)} />
      ) : null}
    </>
  );
}
