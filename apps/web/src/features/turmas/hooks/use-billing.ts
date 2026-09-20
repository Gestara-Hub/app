"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { billingService } from "@/services/billingService";
import type {
  ChargeFilter,
  CreatePlan,
  Id,
  PaymentMethod,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";

// --- Planos (Plans) -------------------------------------------------------
export function usePlans(filter?: PlanFilter) {
  return useQuery({
    queryKey: queryKeys.billing.plans(filter),
    queryFn: () => billingService.listPlans(filter),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlan) => billingService.createPlan(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdatePlan }) =>
      billingService.updatePlan(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useInactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "inactive" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useReactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "active" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

// --- Cobrancas (Charges) --------------------------------------------------
export function useCharges(filter?: ChargeFilter) {
  return useQuery({
    queryKey: queryKeys.billing.charges(filter),
    queryFn: () => billingService.listCharges(filter),
  });
}

export function useGenerateCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competence: string) =>
      billingService.generateCharges(competence),
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

export function useCancelCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.cancelCharge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useRevertCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.reopenCharge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}

export function useClearCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competence?: string) => billingService.clearCharges(competence),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
  });
}


