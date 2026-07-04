"use client";

import type { Permission } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { ProductTour, type TourStep } from "./product-tour";
import { useHydrated } from "../hooks/use-hydrated";
import { useOnboardingState } from "../hooks/use-onboarding-state";

/**
 * Tour guiado de uma tela, disparado no primeiro acesso. Estado por tela em
 * `tours[id]` (nao reabre depois); `useHydrated` evita divergencia de
 * SSR/hidratacao (o tour vive num portal client-only). Opcionalmente restrito a
 * uma permissao. Base reutilizavel por tela — cada tela so define id + passos.
 */
export function ScreenTour({
  id,
  steps,
  permission,
  enabled = true,
}: {
  id: string;
  steps: TourStep[];
  permission?: Permission;
  /** Quando false, nao dispara (ex.: tela aberta numa acao dirigida). */
  enabled?: boolean;
}) {
  const hydrated = useHydrated();
  const can = useCan();
  const [state, update] = useOnboardingState();

  if (
    !enabled ||
    !hydrated ||
    (permission && !can(permission)) ||
    state.tours[id]
  ) {
    return null;
  }

  return (
    <ProductTour
      steps={steps}
      onClose={() => update({ tours: { ...state.tours, [id]: true } })}
    />
  );
}
