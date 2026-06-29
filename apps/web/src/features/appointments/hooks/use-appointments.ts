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
} from "@/types";

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
    mutationFn: (payload: CreateAppointment) => appointmentsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateAppointment }) =>
      appointmentsService.update(id, payload),
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

export function useSetAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: Id; status: AppointmentStatus }) =>
      appointmentsService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}
