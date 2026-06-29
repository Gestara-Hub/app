"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  settingsService,
  type UpdateOrganization,
  type UpdateUnit,
} from "@/services/settingsService";

export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization.detail,
    queryFn: () => settingsService.getOrganization(),
  });
}

export function useUnit() {
  return useQuery({
    queryKey: queryKeys.unit.detail,
    queryFn: () => settingsService.getUnit(),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrganization) =>
      settingsService.updateOrganization(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUnit) => settingsService.updateUnit(payload),
    // businessHours afeta a disponibilidade da Agenda — invalida tudo de leitura.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.unit.detail });
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
  });
}
