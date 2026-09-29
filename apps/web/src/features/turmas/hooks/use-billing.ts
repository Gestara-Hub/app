"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { billingService } from "@/services/billingService";
import { onlinePaymentsService } from "@/services/onlinePaymentsService";
import type {
  ChargeFilter,
  CreatePlan,
  Id,
  OnlinePaymentMethod,
  PaymentMethod,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";

/**
 * Toda mutation de cobranca mexe no dinheiro: invalida Mensalidades, o
 * Financeiro (le as cobrancas como entrada), a previa dos professores, os
 * pagamentos online e a Auditoria.
 */
function invalidateMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.teacherPay.all });
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
}

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
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdatePlan }) =>
      billingService.updatePlan(id, payload),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useInactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "inactive" }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useReactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "active" }),
    onSuccess: () => invalidateMoney(qc),
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
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useMarkChargePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: Id; method?: PaymentMethod }) =>
      billingService.markPaid(id, method),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useMarkChargePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.markPending(id),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useCancelCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.cancelCharge(id),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useRevertCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.reopenCharge(id),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useClearCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competence: string) => billingService.clearCharges(competence),
    onSuccess: () => invalidateMoney(qc),
  });
}

// --- Cobranca online (Pix / link) ------------------------------------------
/** Dialogo "Cobrar online": aluno, telefone e os codigos gerados da cobranca. */
export function useOnlineCheckout(chargeId: Id | null) {
  return useQuery({
    queryKey: queryKeys.onlinePayments.forCharge(chargeId ?? ""),
    queryFn: () => onlinePaymentsService.getCheckout(chargeId!),
    enabled: Boolean(chargeId),
  });
}

export function useCreateOnlinePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, method }: { chargeId: Id; method: OnlinePaymentMethod }) =>
      onlinePaymentsService.createForCharge(chargeId, method),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Demonstracao: marca o codigo e a cobranca como pagos. */
export function useSimulateOnlinePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (onlinePaymentId: Id) => onlinePaymentsService.simulatePaid(onlinePaymentId),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Autorizacoes ativas do Pix Automatico (aviso de limite na linha). */
export function useActiveRecurringAuthorizations(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.onlinePayments.all, "recurring", "active"],
    queryFn: () => onlinePaymentsService.listActiveRecurring(),
    enabled,
  });
}

