"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { packagesService } from "@/services/packagesService";
import type {
  CreateLessonPackage,
  Id,
  LessonPackageFilter,
  SellPackage,
  StudentPackageFilter,
  UpdateLessonPackage,
} from "@gestarahub/contracts";

/**
 * Vender ou cancelar um pacote mexe no dinheiro (cobrancas, Financeiro,
 * pagamento online, Auditoria) e no saldo mostrado na chamada.
 */
function invalidatePackageMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.packages.all });
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  qc.invalidateQueries({ queryKey: queryKeys.classes.all });
  qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
}

// --- Catalogo (Planos > Pacotes de aulas) -----------------------------------
export function useLessonPackages(filter?: LessonPackageFilter) {
  return useQuery({
    queryKey: queryKeys.packages.catalog(filter),
    queryFn: () => packagesService.listPackages(filter),
  });
}

export function useCreateLessonPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLessonPackage) => packagesService.createPackage(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}

export function useUpdateLessonPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateLessonPackage }) =>
      packagesService.updatePackage(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}

// --- Pacotes dos alunos -----------------------------------------------------
export function useStudentPackages(filter?: StudentPackageFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.packages.students(filter),
    queryFn: () => packagesService.listStudentPackages(filter),
    enabled,
  });
}

export function useSellPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SellPackage) => packagesService.sellPackage(payload),
    onSuccess: () => invalidatePackageMoney(qc),
  });
}

export function useCancelStudentPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => packagesService.cancelStudentPackage(id),
    onSuccess: () => invalidatePackageMoney(qc),
  });
}
