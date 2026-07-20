"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersService } from "@/services/usersService";
import type { CreateUser, Id, UpdateUser, UserFilter } from "@gestarahub/contracts";

export function useUsers(filter?: UserFilter) {
  return useQuery({
    queryKey: queryKeys.users.list(filter),
    queryFn: () => usersService.list(filter),
  });
}

export function useUser(id: Id) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersService.getById(id),
    enabled: Boolean(id),
  });
}

// Usuarios de TODOS os tenants (login/troca do demo) — cross-tenant, fora do
// escopo da org ativa.
export function useSwitchableUsers() {
  return useQuery({
    queryKey: ["users", "switch-list"] as const,
    queryFn: () => usersService.listForSwitch(),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUser) => usersService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateUser }) =>
      usersService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useInactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => usersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
