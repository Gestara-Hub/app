"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { eventsService } from "@/services/events";
import type {
  CreateEvent,
  DateISO,
  EventAttendanceStatus,
  EventFilter,
  EventRegistrationPayment,
  Id,
  RegisterForEvent,
  UpdateEvent,
} from "@gestarahub/contracts";

/**
 * Inscricao e cancelamento geram ou cancelam parcelas: alem dos eventos,
 * atualizam Cobrancas, Financeiro, pagamento online, Auditoria e a ficha.
 */
function invalidateRegistrationMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.events.all });
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
}

export function useEvents(filter?: EventFilter) {
  return useQuery({
    queryKey: queryKeys.events.list(filter),
    queryFn: () => eventsService.list(filter),
  });
}

export function useEvent(id: Id) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => eventsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useEventRegistrations(eventId: Id) {
  return useQuery({
    queryKey: queryKeys.events.registrations(eventId),
    queryFn: () => eventsService.listRegistrations(eventId),
    enabled: Boolean(eventId),
  });
}

export function useEventFinance(eventId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.finance.event(eventId),
    queryFn: () => eventsService.getEventFinance(eventId),
    enabled: enabled && Boolean(eventId),
  });
}

/** Certificado de participacao (Pro; sem o recurso, FEATURE_NOT_IN_PLAN). Abrir emite. */
export function useEventCertificate(registrationId: Id) {
  return useQuery({
    queryKey: queryKeys.events.certificate(registrationId),
    queryFn: () => eventsService.getEventCertificate(registrationId),
    enabled: Boolean(registrationId),
    retry: false,
  });
}

export function useEventCertificateCandidates(eventId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.events.certificateCandidates(eventId),
    queryFn: () => eventsService.listEventCertificateCandidates(eventId),
    enabled: enabled && Boolean(eventId),
  });
}

export function useIssueEventCertificates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: Id) => eventsService.issueEventCertificates(eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.events.certificates }),
  });
}

export function useCancelEventCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: Id) => eventsService.cancelEventCertificate(registrationId),
    onSuccess: (_issued, registrationId) => qc.invalidateQueries({ queryKey: queryKeys.events.certificate(registrationId) }),
  });
}

export function useEventSessions(range: { dateFrom: DateISO; dateTo: DateISO }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.events.sessions(range),
    queryFn: () => eventsService.listSessions(range),
    enabled,
  });
}

export function useEventSession(sessionId: Id) {
  return useQuery({
    queryKey: queryKeys.events.session(sessionId),
    queryFn: () => eventsService.getSessionDetail(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEvent) => eventsService.create(payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateEvent }) => eventsService.update(id, payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Id; reason?: string }) => eventsService.cancelEvent(id, reason),
    onSuccess: () => invalidateRegistrationMoney(qc),
  });
}

export function useCancelEventSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: Id; reason?: string }) => eventsService.cancelSession(sessionId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}

export function useRegisterForEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterForEvent) => eventsService.register(input),
    onSuccess: () => invalidateRegistrationMoney(qc),
  });
}

export function usePromoteEventWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, payment }: { registrationId: Id; payment?: EventRegistrationPayment }) =>
      eventsService.promoteFromWaitlist(registrationId, payment),
    onSuccess: () => invalidateRegistrationMoney(qc),
  });
}

export function useCancelEventRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, reason }: { registrationId: Id; reason?: string }) =>
      eventsService.cancelRegistration(registrationId, reason),
    onSuccess: () => invalidateRegistrationMoney(qc),
  });
}

export function useMarkEventAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: Id; registrationId: Id; status: EventAttendanceStatus }) =>
      eventsService.markEventAttendance(input),
    onSuccess: (detail) => {
      qc.setQueryData(queryKeys.events.session(detail.session.id), detail);
      qc.invalidateQueries({ queryKey: queryKeys.events.registrations(detail.event.id) });
    },
  });
}

export function useMarkManyEventAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: Id; registrationIds: Id[]; status: EventAttendanceStatus }) =>
      eventsService.markManyEventAttendance(input),
    onSuccess: (detail) => {
      qc.setQueryData(queryKeys.events.session(detail.session.id), detail);
      qc.invalidateQueries({ queryKey: queryKeys.events.registrations(detail.event.id) });
    },
  });
}

export function useClearEventAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: Id; registrationId: Id }) => eventsService.clearEventAttendance(input),
    onSuccess: (detail) => {
      qc.setQueryData(queryKeys.events.session(detail.session.id), detail);
      qc.invalidateQueries({ queryKey: queryKeys.events.registrations(detail.event.id) });
    },
  });
}

/**
 * Leitura do ingresso na entrada (doc product/29 T4 a T6): confere e, se der,
 * marca presente. `preview` so confere; `confirm` deixa entrar com pagamento em aberto.
 */
export function useCheckInTicket(sessionId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; confirm?: boolean; preview?: boolean }) => eventsService.checkInTicket({ sessionId, ...input }),
    onSuccess: (result) => {
      if (!result.entered) return;
      qc.invalidateQueries({ queryKey: queryKeys.events.session(sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}

/** "Desfazer" da faixa da leitura. */
export function useUndoCheckIn(sessionId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: Id) => eventsService.undoCheckIn({ sessionId, registrationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.session(sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}
