"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { servicosService } from "@/services/servicosService";
import type { CreateServico, Id, ServicoFiltro, UpdateServico } from "@/types";

export function useServices(filtro?: ServicoFiltro) {
  return useQuery({
    queryKey: queryKeys.servicos.list(filtro),
    queryFn: () => servicosService.list(filtro),
  });
}

export function useService(id: Id) {
  return useQuery({
    queryKey: queryKeys.servicos.detail(id),
    queryFn: () => servicosService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServico) => servicosService.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.servicos.all }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateServico }) =>
      servicosService.update(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.servicos.all }),
  });
}

export function useInactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => servicosService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.servicos.all }),
  });
}
