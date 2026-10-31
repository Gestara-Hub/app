"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { CreateStudentMeasurement, Id, UpdateStudentMeasurement } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { measurementsService } from "@/services/measurements";

/** Testes e medidas mudam a ficha do aluno e a auditoria. */
function invalidateMeasurements(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.measurements.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function useStudentMeasurements(studentId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.measurements.student(studentId ?? ""),
    queryFn: () => measurementsService.getStudentMeasurements(studentId ?? ""),
    enabled: Boolean(studentId),
  });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudentMeasurement) => measurementsService.create(payload),
    onSuccess: () => invalidateMeasurements(qc),
  });
}

export function useUpdateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateStudentMeasurement }) => measurementsService.update(id, payload),
    onSuccess: () => invalidateMeasurements(qc),
  });
}

export function useRemoveMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => measurementsService.remove(id),
    onSuccess: () => invalidateMeasurements(qc),
  });
}
