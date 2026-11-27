"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { turmasService } from "@/services/classes";
import { eventsService } from "@/services/events";
import type {
  AttendanceChange,
  CancelEnrollmentChoices,
  ClassGroupFilter,
  CreateClassGroup,
  CreateEnrollment,
  DateISO,
  EnrollmentCourseChoice,
  Id,
  MoveStudentsInput,
  ReservationKind,
  SubstituteInstructorPayload,
  UpdateClassGroup,
} from "@gestarahub/contracts";

/**
 * Matricula em curso gera ou cancela parcelas: alem das turmas, atualiza
 * Cobrancas, Financeiro, pagamento de professores e Auditoria.
 */
function invalidateEnrollmentMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.classes.all });
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.teacherPay.all });
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
  qc.invalidateQueries({ queryKey: queryKeys.clients.trials });
}

/**
 * Dias de evento no periodo, para o Calendario (doc product/29). Fica aqui, e
 * nao em `features/events`, porque o modulo de eventos ja importa este.
 */
export function useCalendarEventSessions(range: { dateFrom: DateISO; dateTo: DateISO }) {
  return useQuery({
    queryKey: queryKeys.events.sessions(range),
    queryFn: () => eventsService.listSessions(range),
  });
}

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
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useUpdateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateClassGroup }) =>
      turmasService.update(id, payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useDeactivateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useReactivateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.reactivate(id),
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

/** Certificado de conclusao do curso (Plano Profissional; sem o recurso, FEATURE_NOT_IN_PLAN). */
export function useCourseCertificate(enrollmentId: Id) {
  return useQuery({
    queryKey: queryKeys.classes.certificate(enrollmentId),
    queryFn: () => turmasService.getCourseCertificate(enrollmentId),
    enabled: Boolean(enrollmentId),
    retry: false,
  });
}

/** Alunos concluidos, para a previa do editor de modelos. */
export function useCompletedEnrollments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.classes.completedEnrollments,
    queryFn: () => turmasService.listCompletedEnrollments(),
    enabled,
  });
}

/** Dados do certificado de um aluno para a previa do editor (sem emitir). */
export function usePreviewCourseCertificate(enrollmentId?: Id) {
  return useQuery({
    queryKey: queryKeys.classes.certificatePreview(enrollmentId ?? ""),
    queryFn: () => turmasService.previewCourseCertificate(enrollmentId!),
    enabled: Boolean(enrollmentId),
    retry: false,
  });
}

/** Emite os certificados de todos os concluidos da turma (doc 21 §1.4). */
export function useIssueCourseCertificates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classGroupId: Id) => turmasService.issueCourseCertificates(classGroupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.certificates });
    },
  });
}

/** Cancela o certificado emitido (doc 21 §1.3); a tela do certificado recarrega. */
export function useCancelCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: Id) => turmasService.cancelCertificate(enrollmentId),
    onSuccess: (_issued, enrollmentId) => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.certificate(enrollmentId) });
    },
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
    onSuccess: () => invalidateEnrollmentMoney(qc),
  });
}

/** Turma de mensalidade: o aluno passa a pagar com pacote ou volta para a mensalidade. */
export function useSetEnrollmentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paysWithPackage }: { id: Id; paysWithPackage: boolean }) =>
      turmasService.setEnrollmentPayment(id, paysWithPackage),
    onSuccess: () => invalidateEnrollmentMoney(qc),
  });
}

/**
 * Cancelar com as escolhas do dinheiro (27/11/2026): plano e cobrancas. Sem
 * `choices`, a regra antiga. O plano encerrado muda a ficha do aluno.
 */
export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, choices }: { id: Id; reason?: string; choices?: CancelEnrollmentChoices }) =>
      turmasService.cancelEnrollment(id, reason, choices),
    onSuccess: (_data, { choices }) => {
      invalidateEnrollmentMoney(qc);
      if (choices?.plan === "end") qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

/** O que cancelar as matriculas mexe no dinheiro (a janela pergunta a partir daqui). */
export function useCancelEnrollmentPreview(enrollmentIds: Id[], enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.classes.cancelPreview(enrollmentIds),
    queryFn: () => turmasService.previewCancelEnrollments(enrollmentIds),
    enabled: enabled && enrollmentIds.length > 0,
    // Sempre a situacao de agora: um pagamento feito ha pouco muda as perguntas.
    staleTime: 0,
  });
}

/** Mudar de turma, um ou varios alunos (doc product/30 §2); com "subir de nivel", mexe na graduacao. */
export function useMoveStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, allowOverCapacity }: { input: MoveStudentsInput; allowOverCapacity?: boolean }) =>
      turmasService.moveStudents(input, { allowOverCapacity }),
    onSuccess: () => {
      invalidateEnrollmentMoney(qc);
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
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

/**
 * Presença muda frequência e o saldo do pacote: relê turmas, sessões, pacotes
 * e resumos dos alunos. A chamada chama uma vez só, quando as gravações acabam.
 */
export function useRefreshAfterAttendance() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.classes.all });
    qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
  };
}

/**
 * Chamada salva pelo botao "Salvar" ou "Concluir chamada" (12/11/2026): os
 * toques ficam na tela e vao numa gravacao so, com o status de cada aluno.
 */
export function useSaveAttendance() {
  const refresh = useRefreshAfterAttendance();
  return useMutation({
    mutationFn: (input: { sessionId: Id; changes: AttendanceChange[] }) => turmasService.saveAttendance(input),
    onSuccess: () => refresh(),
  });
}

/** Alunos com 3 faltas seguidas (atualiza com a chamada: `classes.all`). */
export function useAbsenceStreaks() {
  return useQuery({
    queryKey: queryKeys.classes.absenceStreaks,
    queryFn: () => turmasService.listAbsenceStreaks(3),
  });
}

export function useEnrolledModalities() {
  return useQuery({
    queryKey: queryKeys.classes.enrolledModalities,
    queryFn: () => turmasService.listEnrolledModalities(),
  });
}

export function useAttendanceSummary(date: DateISO) {
  return useQuery({
    queryKey: queryKeys.classes.attendanceSummary(date),
    queryFn: () => turmasService.getAttendanceSummary(date),
    enabled: Boolean(date),
  });
}

export function useSubstituteInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: Id;
      payload: SubstituteInstructorPayload;
    }) => turmasService.substituteInstructor(sessionId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

export function useRestorePrimaryInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: Id) =>
      turmasService.restorePrimaryInstructor(sessionId),
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
    mutationFn: ({ id, course }: { id: Id; course?: EnrollmentCourseChoice }) =>
      turmasService.promoteFromWaitlist(id, course),
    onSuccess: () => invalidateEnrollmentMoney(qc),
  });
}

export function useRemoveFromWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => turmasService.removeFromWaitlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
  });
}

// --- Reservas (Drop-in / Reservations) ------------------------------------
export function useReserveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      classGroupId: Id;
      sessionId: Id;
      studentId: Id;
      kind?: ReservationKind;
      amountCents?: number;
    }) => turmasService.reserveSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
      // Experimental: o selo e o filtro em Alunos e a ficha.
      qc.invalidateQueries({ queryKey: queryKeys.clients.trials });
      qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: Id; studentId: Id }) =>
      turmasService.cancelReservation(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
  });
}

