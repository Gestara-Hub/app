"use client";

import { useState } from "react";
import { setSeenMark, useSeenMark, useSeenMarksReady } from "@/lib/seen-marks";
import { ProductTour, useOnboardingSteps, type TourStep } from "@/features/onboarding";
import { PlansView } from "@/features/turmas";

const SEEN_KEY = "gestarahub_tour_plans_tabs";

const STEPS: TourStep[] = [
  {
    target: "#plans-tab-plans",
    title: "Planos de mensalidade",
    body: "Para quem paga um valor todo mês. As mensalidades são geradas sozinhas, pelas regras da mensalidade.",
  },
  {
    target: "#plans-tab-packages",
    title: "Pacotes de aulas",
    body: "Para quem compra um número de aulas. Cada presença na chamada usa uma aula. Dá para usar os dois.",
  },
];

/**
 * Compoe Planos com o onboarding (sem uma feature importar a outra): no
 * primeiro acesso pela configuracao inicial (passo "Criar planos ou pacotes"
 * pendente), um tour curto explica as duas abas. Mostrado uma vez.
 */
export function PlansScreen() {
  const { nextStep, isReady } = useOnboardingSteps();
  // Marca na conta (lib/seen-marks, 25/11/2026), lida depois de a conta responder.
  const marked = useSeenMark(SEEN_KEY);
  const storedSeen = !useSeenMarksReady() || marked;
  const [closed, setClosed] = useState(false);

  const show = isReady && !storedSeen && !closed && nextStep?.id === "plans";
  const close = () => {
    setSeenMark(SEEN_KEY);
    setClosed(true);
  };

  return (
    <>
      <PlansView />
      {show ? <ProductTour steps={STEPS} onClose={close} mobileMenuStep={false} /> : null}
    </>
  );
}
