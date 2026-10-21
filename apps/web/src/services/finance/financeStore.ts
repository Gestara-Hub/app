import type {
  FinancialCategory,
  FinancialEntry,
  FinancialSystemCategoryKey,
  Id,
} from "@gestarahub/contracts";
import { notFoundError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { systemFinancialCategoryId } from "@/mocks/seed";
import { realAccountInBrowser } from "../world/delegate";
import {
  listFinancialCategoriesFromDb,
  listFinancialEntriesFromDb,
  listFinancialRecurrencesFromDb,
} from "../financeBackend";

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

export async function syncFinanceFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const [categories, recurrences, entries] = await Promise.all([
    listFinancialCategoriesFromDb(organizationId),
    listFinancialRecurrencesFromDb(organizationId),
    listFinancialEntriesFromDb(organizationId),
  ]);

  // Sync Categories
  const catMap = new Map(categories.map((c) => [c.id, c]));
  for (let i = 0; i < store.financialCategories.length; i++) {
    const existing = store.financialCategories[i];
    if (existing.organizationId === organizationId) {
      const fromDb = catMap.get(existing.id);
      if (fromDb) {
        store.financialCategories[i] = fromDb;
        catMap.delete(existing.id);
      }
    }
  }
  for (const cat of catMap.values()) {
    store.financialCategories.push(cat);
  }

  // Sync Recurrences
  const recMap = new Map(recurrences.map((r) => [r.id, r]));
  for (let i = 0; i < store.financialRecurrences.length; i++) {
    const existing = store.financialRecurrences[i];
    if (existing.organizationId === organizationId) {
      const fromDb = recMap.get(existing.id);
      if (fromDb) {
        store.financialRecurrences[i] = fromDb;
        recMap.delete(existing.id);
      }
    }
  }
  for (const rec of recMap.values()) {
    store.financialRecurrences.push(rec);
  }

  // Sync Entries
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  for (let i = 0; i < store.financialEntries.length; i++) {
    const existing = store.financialEntries[i];
    if (existing.organizationId === organizationId) {
      const fromDb = entryMap.get(existing.id);
      if (fromDb) {
        store.financialEntries[i] = fromDb;
        entryMap.delete(existing.id);
      }
    }
  }
  for (const entry of entryMap.values()) {
    store.financialEntries.push(entry);
  }
}

export function findEntry(id: Id): FinancialEntry {
  const e = store.financialEntries.find((x) => x.id === id);
  if (!e) throw notFoundError("Lançamento não encontrado.");
  return e;
}
