"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  AssessmentGradeInput,
  CreateAssessment,
  Id,
  UpdateAssessment,
} from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { gradesService } from "@/services/grades";

/** Notas mudam a lista da turma, o lancamento, o boletim e a auditoria. */
function invalidateGrades(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.grades.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function useClassAssessments(classGroupId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.grades.classAssessments(classGroupId),
    queryFn: () => gradesService.listClassAssessments(classGroupId),
    enabled: enabled && Boolean(classGroupId),
  });
}

export function useAssessmentSheet(assessmentId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.grades.sheet(assessmentId ?? ""),
    queryFn: () => gradesService.getSheet(assessmentId ?? ""),
    enabled: Boolean(assessmentId),
  });
}

export function useStudentReportCard(studentId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.grades.reportCard(studentId ?? ""),
    queryFn: () => gradesService.getReportCard(studentId ?? ""),
    enabled: Boolean(studentId),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssessment) => gradesService.create(payload),
    onSuccess: () => invalidateGrades(qc),
  });
}

export function useUpdateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateAssessment }) => gradesService.update(id, payload),
    onSuccess: () => invalidateGrades(qc),
  });
}

export function useRemoveAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => gradesService.remove(id),
    onSuccess: () => invalidateGrades(qc),
  });
}

export function useSetGrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, grades }: { assessmentId: Id; grades: AssessmentGradeInput[] }) =>
      gradesService.setGrades(assessmentId, grades),
    onSuccess: () => invalidateGrades(qc),
  });
}
