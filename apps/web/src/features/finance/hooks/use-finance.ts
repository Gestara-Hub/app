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
import { ENTRY_ATTACHMENT_RULES } from "@/lib/files";
import { attachmentsService } from "@/services/attachmentsService";
import { financeService } from "@/services/financeService";

// Toda mutation do Financeiro invalida `finance.all` (resumo, serie, lista...).
function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.finance.all });
}

function uploadEntryFiles(files: File[]) {
  return files.length > 0 ? attachmentsService.upload(files, ENTRY_ATTACHMENT_RULES) : Promise.resolve([]);
}

/**
 * Abre um anexo numa nova aba. A aba abre no clique (sem bloqueio de pop-up) e
 * recebe o arquivo quando ele chega. Devolve false se o arquivo nao existe.
 */
export async function openFileAttachment(id: Id): Promise<boolean> {
  const tab = window.open("", "_blank");
  const url = await attachmentsService.openUrl(id);
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) tab.location.href = url;
  else window.location.assign(url);
  // Da tempo da aba carregar antes de liberar a memoria.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
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
    // Envia os arquivos novos antes e grava os anexos junto com o lancamento.
    mutationFn: async ({ payload, files = [] }: { payload: CreateFinancialEntry; files?: File[] }) => {
      const uploaded = await uploadEntryFiles(files);
      return financeService.createEntry(
        uploaded.length > 0 ? { ...payload, attachments: [...(payload.attachments ?? []), ...uploaded] } : payload,
      );
    },
    onSuccess: invalidate,
  });
}

export function useUpdateFinanceEntry() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
      scope,
      files = [],
    }: {
      id: Id;
      payload: UpdateFinancialEntry;
      scope: FinancialEntryUpdateScope;
      /** Arquivos novos; `payload.attachments` traz os anexos que ficaram. */
      files?: File[];
    }) => {
      const uploaded = await uploadEntryFiles(files);
      return financeService.updateEntry(
        id,
        uploaded.length > 0 ? { ...payload, attachments: [...(payload.attachments ?? []), ...uploaded] } : payload,
        scope,
      );
    },
    onSuccess: invalidate,
  });
}

export function useMarkFinanceEntryPaid() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, method, receipts = [] }: { id: Id; method: PaymentMethod; receipts?: File[] }) =>
      financeService.markEntryPaid(id, method, await uploadEntryFiles(receipts)),
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
