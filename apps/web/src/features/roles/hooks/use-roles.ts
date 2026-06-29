"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { rolesService } from "@/services/rolesService";
import type { CreateRole, Id, RoleFilter, UpdateRole } from "@/types";

export function useRoles(filter?: RoleFilter) {
  return useQuery({
    queryKey: queryKeys.roles.list(filter),
    queryFn: () => rolesService.list(filter),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRole) => rolesService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateRole }) =>
      rolesService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

export function useInactivateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => rolesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}
