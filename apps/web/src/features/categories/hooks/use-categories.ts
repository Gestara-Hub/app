"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { categoriesService } from "@/services/categoriesService";
import type {
  CategoryFilter,
  CreateCategory,
  Id,
  UpdateCategory,
} from "@gestarahub/contracts";

export function useCategories(filter?: CategoryFilter) {
  return useQuery({
    queryKey: queryKeys.categories.list(filter),
    queryFn: () => categoriesService.list(filter),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategory) => categoriesService.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateCategory }) =>
      categoriesService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      // Pode fechar a revisao das modalidades do setup (passo do onboarding).
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
    },
  });
}

export function useInactivateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => categoriesService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
}
