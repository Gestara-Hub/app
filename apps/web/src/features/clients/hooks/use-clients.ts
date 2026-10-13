"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { clientsService } from "@/services/clientsService";
import type {
  ClientFilter,
  CreateClassRecordsBatch,
  CreateClient,
  CreateStudentClassRecord,
  DateISO,
  Id,
  ProgressionBeltColor,
  StudentModalityProgression,
  UpdateClient,
} from "@gestarahub/contracts";

export function useClients(filter?: ClientFilter) {
  return useQuery({
    queryKey: queryKeys.clients.list(filter),
    queryFn: () => clientsService.list(filter),
  });
}

export function useClient(id: Id) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => clientsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useStudentProgressionOverview(studentId?: Id) {
  return useQuery({
    queryKey: [...queryKeys.clients.all, "progression", studentId ?? ""],
    queryFn: () => clientsService.getProgressionOverview(studentId!),
    enabled: Boolean(studentId),
  });
}

/** Pontos fortes e focos ja usados pelo espaco (atualiza ao salvar a ficha: `clients.all`). */
export function useProgressionTermSuggestions(modalityId?: Id) {
  return useQuery({
    queryKey: queryKeys.clients.progressionTerms(modalityId ?? ""),
    queryFn: () => clientsService.getProgressionTermSuggestions(modalityId!),
    enabled: Boolean(modalityId),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClient) => clientsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateClient }) =>
      clientsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useInactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cancelOpenCharges }: { id: Id; cancelOpenCharges?: boolean }) =>
      clientsService.remove(id, { cancelOpenCharges }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useSaveModalityProgression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      studentId,
      progression,
    }: {
      studentId: Id;
      progression: Omit<StudentModalityProgression, "updatedAt">;
    }) => clientsService.saveModalityProgression(studentId, progression),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function usePromoteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      studentId: Id;
      modalityId: Id;
      modalityName?: string;
      toLevelId?: string;
      toLevelName: string;
      toLevelColor?: ProgressionBeltColor;
      toSubLevel: number;
      maxSubLevels?: number;
      date: DateISO;
      attendancesCompleted?: number;
      monthsInLevel?: number;
      isExam?: boolean;
      notes?: string;
      examiner?: string;
    }) => clientsService.promoteStudent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

/** Toda escrita de progresso invalida `clients.all` (ficha, lista, sugestoes). */
function useClientsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useAddClassRecord() {
  return useClientsMutation((payload: CreateStudentClassRecord) => clientsService.addClassRecord(payload));
}

/** Registro da turma inteira (chamada). */
export function useAddClassRecords() {
  return useClientsMutation((payload: CreateClassRecordsBatch) => clientsService.addClassRecords(payload));
}

export function useUpdateStrengths() {
  return useClientsMutation(
    ({ studentId, modalityId, strengths }: { studentId: Id; modalityId: Id; strengths: string[] }) =>
      clientsService.updateStrengths(studentId, modalityId, strengths),
  );
}

export function useAddGoal() {
  return useClientsMutation(
    ({ studentId, modalityId, title, target }: { studentId: Id; modalityId: Id; title: string; target?: number }) =>
      clientsService.addGoal(studentId, modalityId, { title, target }),
  );
}

export function useSetGoalCompleted() {
  return useClientsMutation(
    ({ studentId, modalityId, goalId, completed }: { studentId: Id; modalityId: Id; goalId: Id; completed: boolean }) =>
      clientsService.setGoalCompleted(studentId, modalityId, goalId, completed),
  );
}

export function useRemoveGoal() {
  return useClientsMutation(
    ({ studentId, modalityId, goalId }: { studentId: Id; modalityId: Id; goalId: Id }) =>
      clientsService.removeGoal(studentId, modalityId, goalId),
  );
}

