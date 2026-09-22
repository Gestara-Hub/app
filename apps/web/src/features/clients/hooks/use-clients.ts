"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { clientsService } from "@/services/clientsService";
import type { ClientFilter, CreateClient, Id, UpdateClient } from "@gestarahub/contracts";

export function useClients(filter?: ClientFilter) {
  return useQuery({
    queryKey: queryKeys.clients.list(filter),
    queryFn: () => clientsService.list(filter),
  });
}

export function useClient(id: Id) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => clientsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClient) => clientsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateClient }) =>
      clientsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

export function useInactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => clientsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.all });
      // Cadastro, troca de plano e inativacao criam ou cancelam mensalidades.
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}
