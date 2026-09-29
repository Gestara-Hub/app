"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { subscriptionService } from "@/services/subscriptionService";

/** Plano GestaraHub do tenant (assinatura). */
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription.detail,
    queryFn: () => subscriptionService.get(),
  });
}

/**
 * Troca o tier (demonstracao; so o proprietario). Invalida a organizacao: o
 * SessionProvider le o tier dela, atualiza o cadeado da nav e espelha no cookie
 * do server (as pages pagas trocam upsell <-> tela).
 */
export function useSetSubscriptionTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tier: SubscriptionTier) => subscriptionService.setTier(tier),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subscription.detail });
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}
