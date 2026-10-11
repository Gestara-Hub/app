"use client";

import { useState } from "react";
import { useCurrentUser } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";
import { ProductTour } from "./product-tour";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

import { TOUR_STEPS_CLASSES, TOUR_STEPS_DEFAULT } from "./tour-steps";

/**
 * Orquestra o checklist e tour guiado no Dashboard após a conclusão do setup inicial.
 * Só aparece para o Proprietário enquanto as etapas recomendadas não foram concluídas.
 */
export function Onboarding() {
  const user = useCurrentUser();
  const [state, update] = useOnboardingState();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { steps, doneCount, total, isReady, isComplete, isClasses } =
    useOnboardingSteps();
  const [tourOpen, setTourOpen] = useState(false);

  if (!isReady || orgLoading || user.profile !== "owner") return null;

  // Se o proprietário ainda não concluiu o setup inicial (/setup), o SetupGuard já
  // o redirecionará para a tela de setup. Não renderiza nada aqui.
  if (!organization?.settings?.onboardingCompleted) return null;

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
          highlightNextStep={!tourOpen && !welcomeOpen}
          onStartTour={() => {
            update({ seen: true });
            setTourOpen(true);
          }}
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
        onStartSetup={() => {
          update({ seen: true });
        }}
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
