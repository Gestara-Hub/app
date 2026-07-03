"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { professionalsService } from "@/services/professionalsService";
import type {
  CreateProfessional,
  Id,
  ProfessionalFilter,
  UpdateProfessional,
} from "@gestarahub/contracts";

export function useProfessionals(filter?: ProfessionalFilter) {
  return useQuery({
    queryKey: queryKeys.professionals.list(filter),
    queryFn: () => professionalsService.list(filter),
  });
}

export function useProfessional(id: Id) {
  return useQuery({
    queryKey: queryKeys.professionals.detail(id),
    queryFn: () => professionalsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProfessional) =>
      professionalsService.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.professionals.all }),
  });
}

export function useUpdateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateProfessional }) =>
      professionalsService.update(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.professionals.all }),
  });
}

export function useInactivateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => professionalsService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.professionals.all }),
  });
}
