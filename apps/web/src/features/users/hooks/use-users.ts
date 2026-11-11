"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersService } from "@/services/users";
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

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUser) => usersService.create(payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateUser }) =>
      usersService.update(id, payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
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

export function useResendInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => usersService.resendInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
