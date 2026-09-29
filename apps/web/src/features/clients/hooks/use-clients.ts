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
  CreateClient,
  DateISO,
  EvaluationEntryTone,
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
    mutationFn: (id: Id) => clientsService.remove(id),
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
      toLevelColor: ProgressionBeltColor;
      toSubLevel: number;
      maxSubLevels?: number;
      date: DateISO;
      attendancesCompleted?: number;
      monthsInLevel?: number;
      isExam?: boolean;
      notes?: string;
    }) => clientsService.promoteStudent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useAddSessionEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      studentId: Id;
      modalityId: Id;
      modalityName?: string;
      classGroupId?: Id;
      classGroupName?: string;
      sessionId?: Id;
      date: DateISO;
      tone: EvaluationEntryTone;
      note: string;
      authorName?: string;
    }) => clientsService.addSessionEvaluation(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

