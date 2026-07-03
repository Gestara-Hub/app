"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { appointmentsService } from "@/services/appointmentsService";
import type {
  AppointmentFilter,
  AppointmentStatus,
  CreateAppointment,
  Id,
  RescheduleAppointment,
  UpdateAppointment,
} from "@gestarahub/contracts";

export function useAppointments(filter?: AppointmentFilter) {
  return useQuery({
    queryKey: queryKeys.appointments.list(filter),
    queryFn: () => appointmentsService.list(filter),
  });
}

export function useAppointment(id: Id) {
  return useQuery({
    queryKey: queryKeys.appointments.detail(id),
    queryFn: () => appointmentsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    // allowBreak = agendar mesmo no intervalo de almoco (override confirmado).
    mutationFn: ({
      payload,
      allowBreak,
    }: {
      payload: CreateAppointment;
      allowBreak?: boolean;
    }) => appointmentsService.create(payload, { allowBreak }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      allowBreak,
    }: {
      id: Id;
      payload: UpdateAppointment;
      allowBreak?: boolean;
    }) => appointmentsService.update(id, payload, { allowBreak }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: RescheduleAppointment }) =>
      appointmentsService.reschedule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useRescheduleSeriesFuture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: Id;
      payload: { start?: string; professionalId?: Id; reason?: string };
    }) => appointmentsService.rescheduleSeriesFuture(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useSetAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: Id; status: AppointmentStatus }) =>
      appointmentsService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Id; reason: string }) =>
      appointmentsService.cancel(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useMarkNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Id; reason?: string }) =>
      appointmentsService.markNoShow(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}
