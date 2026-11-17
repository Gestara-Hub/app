"use client";

import { useEffect, useRef, useState } from "react";
import { useRouteLoadingBar } from "@/components/layout/navigation-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { onReplayTour } from "@/features/support";
import { DiscoveryChecklist } from "./discovery-checklist";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";
import { ProductTour } from "@/components/shared/product-tour";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

import { TOUR_STEPS_DEFAULT, tourStepsForClasses } from "./tour-steps";

/**
 * Orquestra o checklist e tour guiado no Dashboard após a conclusão do setup inicial.
 * Exibido para Proprietário e Gerente enquanto as etapas recomendadas não foram concluídas.
 * Concluídas (turmas), o lugar passa ao "Descubra o dia a dia" (dono e gerente).
 */
export function Onboarding() {
  const user = useCurrentUser();
  const [state, update] = useOnboardingState();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const {
    steps,
    doneCount,
    total,
    isReady,
    isComplete,
    isClasses,
    isCourseArea,
    areaBillingMode,
    hasProgressionTrack,
  } = useOnboardingSteps();
  const [tourOpen, setTourOpen] = useState(false);
  // Fechou as boas-vindas sem pedir o tour: destaca o passo atual uma vez.
  const [spotlightStep, setSpotlightStep] = useState(false);
  // O fechar das boas-vindas pode vir depois do "tour guiado" (mesmo clique):
  // a ref evita destacar o passo quando a pessoa escolheu o tour.
  const tourChosenRef = useRef(false);

  // "Rever o tour" na Ajuda do app.
  useEffect(() => onReplayTour(() => setTourOpen(true)), []);

  const loading = !isReady || orgLoading;
  useRouteLoadingBar(loading);

  if (loading) {
    const maySeeChecklist =
      (user.profile === "owner" || user.profile === "manager") && !state.dismissed;
    if (!maySeeChecklist) return null;
    return (
      <div className="mb-8 w-full space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-busy>
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="space-y-2 pt-1">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Se o proprietário ainda não concluiu o setup inicial (/setup), o SetupGuard já
  // o redirecionará para a tela de setup. Não renderiza nada aqui.
  if (!organization?.settings?.onboardingCompleted) return null;

  // Primeiros passos concluídos: o card opcional do dia a dia ocupa o lugar.
  const discovery =
    isComplete && isClasses ? (
      <DiscoveryChecklist
        areaBillingMode={areaBillingMode}
        hasProgressionTrack={hasProgressionTrack}
      />
    ) : null;

  if (user.profile !== "owner" && user.profile !== "manager") return discovery;

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
          isCourseArea={isCourseArea}
          highlightNextStep={!tourOpen && !welcomeOpen}
          spotlightNextStep={spotlightStep}
          onSpotlightDone={() => setSpotlightStep(false)}
          onStartTour={() => {
            update({ seen: true });
            setSpotlightStep(false);
            setTourOpen(true);
          }}
        />
      ) : (
        discovery
      )}

      <OnboardingWelcomeDialog
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (!open) {
            update({ seen: true });
            if (!tourChosenRef.current) setSpotlightStep(true);
          }
        }}
        onStartTour={() => {
          tourChosenRef.current = true;
          update({ seen: true });
          setSpotlightStep(false);
          setTourOpen(true);
        }}
        onStartSetup={() => {
          update({ seen: true });
          setSpotlightStep(true);
        }}
        isClasses={isClasses}
        areaBillingMode={areaBillingMode}
      />

      {tourOpen ? (
        <ProductTour
          steps={isClasses ? tourStepsForClasses(areaBillingMode) : TOUR_STEPS_DEFAULT}
          onClose={() => setTourOpen(false)}
        />
      ) : null}
    </>
  );
}
