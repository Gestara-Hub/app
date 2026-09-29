"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFinancialCategory,
  CreateFinancialEntry,
  FinancialCategoryFilter,
  FinancialEntryFilter,
  FinancialEntryType,
  FinancialEntryUpdateScope,
  Id,
  PaymentMethod,
  UpdateFinancialCategory,
  UpdateFinancialEntry,
} from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { financeService } from "@/services/financeService";

// Toda mutation do Financeiro invalida `finance.all` (resumo, serie, lista...).
function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.finance.all });
}

// --- Resumo -----------------------------------------------------------------

export function useFinanceSummary(competence: string) {
  return useQuery({
    queryKey: queryKeys.finance.summary(competence),
    queryFn: () => financeService.getSummary(competence),
  });
}

export function useFinanceSeries(months: number, endCompetence: string) {
  return useQuery({
    queryKey: queryKeys.finance.series(months, endCompetence),
    queryFn: () => financeService.getMonthlySeries(months, endCompetence),
  });
}

export function useFinanceByCategory(competence: string) {
  return useQuery({
    queryKey: queryKeys.finance.byCategory(competence),
    queryFn: () => financeService.getByCategory(competence),
  });
}

export function useFinanceUpcoming(days = 7) {
  return useQuery({
    queryKey: queryKeys.finance.upcoming(days),
    queryFn: () => financeService.getUpcoming(days),
  });
}

// --- Lancamentos ------------------------------------------------------------

export function useFinanceEntries(filter: FinancialEntryFilter) {
  return useQuery({
    queryKey: queryKeys.finance.entries(filter),
    queryFn: () => financeService.listEntries(filter),
    // Mantem a lista enquanto troca filtro/busca (sem piscar o skeleton).
    placeholderData: keepPreviousData,
  });
}

export function useCreateFinanceEntry() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (payload: CreateFinancialEntry) => financeService.createEntry(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFinanceEntry() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      scope,
    }: {
      id: Id;
      payload: UpdateFinancialEntry;
      scope: FinancialEntryUpdateScope;
    }) => financeService.updateEntry(id, payload, scope),
    onSuccess: invalidate,
  });
}

export function useMarkFinanceEntryPaid() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, method }: { id: Id; method: PaymentMethod }) =>
      financeService.markEntryPaid(id, method),
    onSuccess: invalidate,
  });
}

export function useMarkFinanceEntryPending() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: Id) => financeService.markEntryPending(id),
    onSuccess: invalidate,
  });
}

export function useCancelFinanceEntry() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: Id) => financeService.cancelEntry(id),
    onSuccess: invalidate,
  });
}

export function useDeleteFinanceEntry() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: Id) => financeService.deleteEntry(id),
    onSuccess: invalidate,
  });
}

export function useEndFinanceRecurrence() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (recurrenceId: Id) => financeService.endRecurrence(recurrenceId),
    onSuccess: invalidate,
  });
}

// --- Categorias -------------------------------------------------------------

export function useFinancialCategories(filter?: FinancialCategoryFilter) {
  return useQuery({
    queryKey: queryKeys.finance.categories(filter),
    queryFn: () => financeService.listCategories(filter),
  });
}

export function useCreateFinancialCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (payload: CreateFinancialCategory) => financeService.createCategory(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFinancialCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateFinancialCategory }) =>
      financeService.updateCategory(id, payload),
    onSuccess: invalidate,
  });
}

/**
 * Hooks sem argumento para o EntityManagerDialog, presos a um tipo. So as
 * categorias editaveis (as de sistema ficam fora: sao travadas).
 */
export function makeFinancialCategoryManagerHooks(type: FinancialEntryType) {
  return {
    useList: () => useFinancialCategories({ type, includeSystem: false }),
    useCreate: () => {
      const mut = useCreateFinancialCategory();
      return {
        isPending: mut.isPending,
        mutateAsync: ({ name }: { name: string }) => mut.mutateAsync({ type, name }),
      };
    },
    useUpdate: useUpdateFinancialCategory,
    useInactivate: () => {
      const mut = useUpdateFinancialCategory();
      return {
        isPending: mut.isPending,
        mutateAsync: (id: string) => mut.mutateAsync({ id, payload: { status: "inactive" } }),
      };
    },
  };
}
