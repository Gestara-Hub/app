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
