"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Id } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { onlinePaymentsService } from "@/services/onlinePaymentsService";

/**
 * Pix Automatico do aluno. Ativar ja paga as mensalidades vencidas dentro do
 * limite, entao toda mutation invalida tambem Mensalidades e Financeiro.
 */
function invalidateRecurring(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.teacherPay.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function useRecurringAuthorization(studentId?: Id) {
  return useQuery({
    queryKey: queryKeys.onlinePayments.recurring(studentId ?? ""),
    queryFn: () => onlinePaymentsService.getRecurringForStudent(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useRequestRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      studentId,
      maxAmountCents,
    }: {
      studentId: Id;
      maxAmountCents: number;
    }) => onlinePaymentsService.requestRecurring(studentId, maxAmountCents),
    onSuccess: () => invalidateRecurring(qc),
  });
}

/** Demonstracao: o aluno autorizou no app do banco. */
export function useSimulateRecurringAuthorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => onlinePaymentsService.simulateAuthorize(id),
    onSuccess: () => invalidateRecurring(qc),
  });
}

export function useRevokeRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => onlinePaymentsService.revokeRecurring(id),
    onSuccess: () => invalidateRecurring(qc),
  });
}
