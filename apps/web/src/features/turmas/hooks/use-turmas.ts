"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { turmasService } from "@/services/turmasService";
import type {
  AttendanceStatus,
  ClassGroupFilter,
  CreateClassGroup,
  CreateEnrollment,
  DateISO,
  Id,
  UpdateClassGroup,
} from "@gestarahub/contracts";

// --- Turmas ---------------------------------------------------------------
export function useClassGroups(filter?: ClassGroupFilter) {
  return useQuery({
    queryKey: queryKeys.classes.list(filter),
    queryFn: () => turmasService.list(filter),
  });
}

export function useClassGroup(id: Id) {
  return useQuery({
    queryKey: queryKeys.classes.detail(id),
    queryFn: () => turmasService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClassGroup) => turmasService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useUpdateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateClassGroup }) =>
      turmasService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Matriculas -----------------------------------------------------------
export function useEnrollments(classGroupId: Id) {
  return useQuery({
    queryKey: queryKeys.classes.enrollments(classGroupId),
    queryFn: () => turmasService.listEnrollments(classGroupId),
    enabled: Boolean(classGroupId),
  });
}

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      allowOverCapacity,
    }: {
      payload: CreateEnrollment;
      allowOverCapacity?: boolean;
    }) => turmasService.enroll(payload, { allowOverCapacity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Id; reason?: string }) =>
      turmasService.cancelEnrollment(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Sessoes + presenca ---------------------------------------------------
export function useClassSessions(range: {
  classGroupId?: Id;
  dateFrom: DateISO;
  dateTo: DateISO;
}) {
  return useQuery({
    queryKey: queryKeys.classes.sessions(range),
    queryFn: () => turmasService.listSessions(range),
  });
}

export function useClassSession(sessionId: Id) {
  return useQuery({
    queryKey: queryKeys.classes.session(sessionId),
    queryFn: () => turmasService.getSession(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionId: Id;
      studentId: Id;
      status: AttendanceStatus;
    }) => turmasService.markAttendance(input),
    // Presenca muda frequencia e pode abrir/fechar reposicao -> invalida tudo.
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Lista de espera ------------------------------------------------------
export function useWaitlist(classGroupId: Id) {
  return useQuery({
    queryKey: queryKeys.classes.waitlist(classGroupId),
    queryFn: () => turmasService.listWaitlist(classGroupId),
    enabled: Boolean(classGroupId),
  });
}

export function useAddToWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classGroupId: Id; studentId: Id }) =>
      turmasService.addToWaitlist(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function usePromoteWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.promoteFromWaitlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useRemoveFromWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.removeFromWaitlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Reposicoes -----------------------------------------------------------
export function useReposicoes(classGroupId?: Id) {
  return useQuery({
    queryKey: queryKeys.classes.reposicoes(classGroupId),
    queryFn: () => turmasService.listReposicoes(classGroupId),
  });
}

export function useScheduleReposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, makeupSessionId }: { id: Id; makeupSessionId: Id }) =>
      turmasService.scheduleReposicao(id, makeupSessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useConcludeReposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.concludeReposicao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Reservas (drop-in) ---------------------------------------------------
export function useReserveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classGroupId: Id; sessionId: Id; studentId: Id }) =>
      turmasService.reserveSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useCancelReserva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: Id; studentId: Id }) =>
      turmasService.cancelReserva(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}
