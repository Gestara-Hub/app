import type {
  FinancialCategory,
  FinancialEntry,
  FinancialSystemCategoryKey,
  Id,
} from "@gestarahub/contracts";
import { notFoundError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { systemFinancialCategoryId } from "@/mocks/seed";

// --- Categorias -------------------------------------------------------------

export function categoryOf(id?: Id): FinancialCategory | undefined {
  return id ? store.financialCategories.find((c) => c.id === id) : undefined;
}

/** Id da categoria de sistema (pela chave; cai no id deterministico do seed). */
export function systemCategoryId(key: FinancialSystemCategoryKey): Id {
  return (
    store.financialCategories.find((c) => c.systemKey === key)?.id ??
    systemFinancialCategoryId(store.organization.id, key)
  );
}

export function categoryName(id?: Id, fallback = "Sem categoria"): string {
  return categoryOf(id)?.name ?? fallback;
}

export function findEntry(id: Id): FinancialEntry {
  const e = store.financialEntries.find((x) => x.id === id);
  if (!e) throw notFoundError("Lançamento não encontrado.");
  return e;
}
