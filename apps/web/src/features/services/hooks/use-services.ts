"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { servicesService } from "@/services/servicesService";
import type { CreateService, Id, ServiceFilter, UpdateService } from "@gestarahub/contracts";

export function useServices(filter?: ServiceFilter) {
  return useQuery({
    queryKey: queryKeys.services.list(filter),
    queryFn: () => servicesService.list(filter),
  });
}

export function useService(id: Id) {
  return useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: () => servicesService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateService) => servicesService.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateService }) =>
      servicesService.update(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  });
}

export function useInactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => servicesService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  });
}
