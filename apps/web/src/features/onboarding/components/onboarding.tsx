"use client";

import { useState } from "react";
import { useCurrentUser } from "@/features/auth";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";
import { ProductTour } from "./product-tour";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

import { TOUR_STEPS_CLASSES, TOUR_STEPS_DEFAULT } from "./tour-steps";

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
        isClasses={isClasses}
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
