"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { billingService } from "@/services/billingService";
import type {
  CobrancaFilter,
  CreatePlano,
  Id,
  PaymentMethod,
  PlanoFilter,
  UpdatePlano,
} from "@gestarahub/contracts";

// --- Planos ---------------------------------------------------------------
export function usePlans(filter?: PlanoFilter) {
  return useQuery({
    queryKey: queryKeys.billing.plans(filter),
    queryFn: () => billingService.listPlans(filter),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlano) => billingService.createPlan(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdatePlano }) =>
      billingService.updatePlan(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

// --- Cobrancas ------------------------------------------------------------
export function useCharges(filter?: CobrancaFilter) {
  return useQuery({
    queryKey: queryKeys.billing.charges(filter),
    queryFn: () => billingService.listCharges(filter),
  });
}

export function useGenerateCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competencia: string) =>
      billingService.generateCharges(competencia),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useMarkChargePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: Id; method?: PaymentMethod }) =>
      billingService.markPaid(id, method),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useMarkChargePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.markPending(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}
