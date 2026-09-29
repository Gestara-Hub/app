"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  Id,
  PaymentMethod,
  SaveTeacherPayRule,
  TeacherPayoutAdjustment,
} from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { teacherPayService } from "@/services/teacherPayService";

// Chave local da lista de professores da aba (sem entrada propria em queryKeys).
const teachersKey = queryKeys.teacherPay.teachers;

// Mudancas no pagamento do professor mexem na previa e no caixa (Resumo/Lancamentos).
function invalidateTeacherPay(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.teacherPay.all }),
    qc.invalidateQueries({ queryKey: queryKeys.finance.all }),
  ]);
}

export function useTeacherPayTeachers() {
  return useQuery({
    queryKey: teachersKey,
    queryFn: () => teacherPayService.listTeachers(),
  });
}

export function useTeacherPayouts(competence: string) {
  return useQuery({
    queryKey: queryKeys.teacherPay.payouts(competence),
    queryFn: () => teacherPayService.listPayouts(competence),
  });
}

export function useTeacherPayoutPreview(professionalId: Id | null, competence: string) {
  return useQuery({
    queryKey: queryKeys.teacherPay.preview(professionalId ?? "", competence),
    queryFn: () => teacherPayService.getPayoutPreview(professionalId!, competence),
    enabled: Boolean(professionalId),
  });
}

export function useSaveTeacherPayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ professionalId, payload }: { professionalId: Id; payload: SaveTeacherPayRule }) =>
      teacherPayService.saveRule(professionalId, payload),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}

export function useSaveTeacherPayoutAdjustments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      professionalId,
      competence,
      adjustments,
    }: {
      professionalId: Id;
      competence: string;
      adjustments: TeacherPayoutAdjustment[];
    }) => teacherPayService.saveAdjustments(professionalId, competence, adjustments),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}

export function useCloseTeacherPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      professionalId,
      competence,
      adjustments,
    }: {
      professionalId: Id;
      competence: string;
      adjustments: TeacherPayoutAdjustment[];
    }) => teacherPayService.closePayout(professionalId, competence, adjustments),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}

export function useReopenTeacherPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => teacherPayService.reopenPayout(id),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}

export function useMarkTeacherPayoutPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: Id; method: PaymentMethod }) =>
      teacherPayService.markPayoutPaid(id, method),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}

export function useMarkTeacherPayoutUnpaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => teacherPayService.markPayoutUnpaid(id),
    onSuccess: () => invalidateTeacherPay(qc),
  });
}
