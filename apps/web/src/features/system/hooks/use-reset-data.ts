"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { systemService } from "@/services/system";

export function useResetData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.resetData(),
    // Reset afeta todas as colecoes: invalida todo o cache de Query.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useClearData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.clearData(),
    onSuccess: () => qc.invalidateQueries(),
  });
}
