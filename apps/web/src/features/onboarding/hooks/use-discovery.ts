"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ClassBillingMode } from "@gestarahub/contracts";
import { useCan, useCurrentUser } from "@/features/auth";
import { useBusinessSegment } from "@/features/settings";
import {
  discoveryDismissedKey,
  discoveryVisitedKey,
  setStorageFlag,
  useStorageFlag,
} from "@/lib/discovery-flags";
import { queryKeys } from "@/lib/queryKeys";
import { onboardingService } from "@/services/settings/onboardingService";
import { buildDiscoveryItems, summarizeDiscovery } from "../discovery-items";

/**
 * Dados do card "Descubra o dia a dia": marcos do store (uma leitura) + telas
 * ja abertas e o "Fechar" (navegador, por organizacao e usuario).
 * Atualizacao: qualquer mutacao bem-sucedida refaz a leitura se o card esta na
 * tela (`createQueryClient`); fora dela, a leitura fica velha e refaz ao montar.
 */
export function useDiscovery(
  areaBillingMode: ClassBillingMode,
  enabled: boolean,
  hasProgressionTrack?: boolean,
) {
  const user = useCurrentUser();
  const can = useCan();
  const segment = useBusinessSegment();
  const dismissedKey = discoveryDismissedKey(user);
  const dismissed = useStorageFlag(dismissedKey);
  const courseBilling = useStorageFlag(discoveryVisitedKey(user, "course_billing"));
  const finance = useStorageFlag(discoveryVisitedKey(user, "finance"));

  const query = useQuery({
    queryKey: queryKeys.onboarding.discovery,
    queryFn: () => onboardingService.getDiscoveryMilestones(),
    enabled: enabled && !dismissed,
  });

  const resolvedHasProgression =
    hasProgressionTrack !== undefined ? hasProgressionTrack : segment.progressionTemplate !== null;

  const items = query.data
    ? buildDiscoveryItems({
        milestones: query.data,
        visited: { courseBilling, finance },
        areaBillingMode,
        can,
        hasProgressionTrack: resolvedHasProgression,
      })
    : [];

  const dismiss = useCallback(() => setStorageFlag(dismissedKey), [dismissedKey]);

  return {
    items,
    ...summarizeDiscovery(items),
    isReady: Boolean(query.data),
    dismissed,
    dismiss,
  };
}
