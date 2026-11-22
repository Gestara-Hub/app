"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import type { PlanTarget } from "@/services/subscription/actions";

/** Historico do plano (doc technical/23). */
export function usePlanHistory(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.subscription.detail, "history"],
    queryFn: () => subscriptionService.listHistory(),
    enabled,
  });
}

/** Notas fiscais do plano (doc technical/24 §7.1). */
export function usePlatformInvoices(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.subscription.detail, "invoices"],
    queryFn: () => subscriptionService.listInvoices(),
    enabled,
  });
}

/** Conta da troca de plano (doc product/13 §6), para a confirmacao. */
export function usePlanChangePreview(target: PlanTarget | null) {
  return useQuery({
    queryKey: [...queryKeys.subscription.detail, "change-preview", target?.tier, target?.interval],
    queryFn: () => subscriptionService.previewPlanChange(target as PlanTarget),
    enabled: target !== null,
    // A conta depende do dia: sempre a de agora.
    staleTime: 0,
  });
}

function useInvalidatePlan() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.subscription.detail });
    qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
    qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  };
}

export function usePlanChange() {
  const invalidate = useInvalidatePlan();
  const change = useMutation({
    mutationFn: (target: PlanTarget) => subscriptionService.changePlan(target),
    onSuccess: invalidate,
  });
  const simulate = useMutation({
    mutationFn: (paymentId: string) => subscriptionService.simulatePlanChangePayment(paymentId),
    onSuccess: (res) => {
      if (res.isPaid) invalidate();
    },
  });
  const cancelScheduled = useMutation({
    mutationFn: () => subscriptionService.cancelScheduledChange(),
    onSuccess: invalidate,
  });
  // Pago: o servidor ja ligou o plano; a tela le de novo.
  const checkPayment = async (paymentId: string) => {
    const res = await subscriptionService.checkPlanChangePayment(paymentId);
    if (res.isPaid) invalidate();
    return res;
  };
  return { change, simulate, cancelScheduled, checkPayment };
}
