"use client";

import { useState, useSyncExternalStore } from "react";
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

const noopSubscribe = () => () => {};

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Compoe Planos com o onboarding (sem uma feature importar a outra): no
 * primeiro acesso pela configuracao inicial (passo "Criar planos ou pacotes"
 * pendente), um tour curto explica as duas abas. Mostrado uma vez.
 */
export function PlansScreen() {
  const { nextStep, isReady } = useOnboardingSteps();
  // Le o localStorage so no navegador (no servidor conta como visto: sem
  // diferenca de hidratacao).
  const storedSeen = useSyncExternalStore(noopSubscribe, readSeen, () => true);
  const [closed, setClosed] = useState(false);

  const show = isReady && !storedSeen && !closed && nextStep?.id === "plans";
  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // sem localStorage: o tour pode voltar, sem prejuizo
    }
    setClosed(true);
  };

  return (
    <>
      <PlansView />
      {show ? <ProductTour steps={STEPS} onClose={close} mobileMenuStep={false} /> : null}
    </>
  );
}
