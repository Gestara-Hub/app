import type {
  ApiErrorField,
  CreateFinancialCategory,
  FinancialCategory,
  FinancialCategoryFilter,
  FinancialEntryType,
  Id,
  UpdateFinancialCategory,
} from "@gestarahub/contracts";
import { financialEntryTypeLabel } from "@/lib/labels";
import {
  newId,
  normalizeText,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { isSupabaseOrganization } from "@/lib/session";
import { createFinancialCategoryInDb, updateFinancialCategoryInDb } from "../financeBackend";
import { auditLogService } from "../auditLogService";
import { clone, conflict, isEntryType } from "./financeHelpers";
import { syncFinanceFromDb } from "./financeStore";

export function isDuplicateCategory(type: FinancialEntryType, name: string, exceptId?: Id): boolean {
  const target = normalizeText(name);
  return store.financialCategories.some(
    (c) => c.type === type && c.id !== exceptId && normalizeText(c.name) === target,
  );
}

export function sortCategories(list: FinancialCategory[]): FinancialCategory[] {
  return [...list].sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      Number(Boolean(b.system)) - Number(Boolean(a.system)) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

export const financeCategoriesService = {
  // --- Categorias -----------------------------------------------------------

  listCategories(filter?: FinancialCategoryFilter): Promise<FinancialCategory[]> {
    return simulateRead(async () => {
      await syncFinanceFromDb(store.organization.id);
      let result = store.financialCategories;
      if (filter?.type) result = result.filter((c) => c.type === filter.type);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.includeSystem === false) result = result.filter((c) => !c.system);
      return clone(sortCategories(result));
    });
  },

  createCategory(payload: CreateFinancialCategory): Promise<FinancialCategory> {
    return simulateWrite(async () => {
      const fields: ApiErrorField[] = [];
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!isEntryType(payload.type)) fields.push({ field: "type", message: "Escolha entre entrada e saída." });
      if (!name) fields.push({ field: "name", message: "Informe o nome da categoria." });
      else if (name.length > 60) fields.push({ field: "name", message: "Use no máximo 60 caracteres." });
      else if (isEntryType(payload.type) && isDuplicateCategory(payload.type, name)) {
        fields.push({ field: "name", message: "Já existe uma categoria com esse nome." });
      }
      if (fields.length > 0) throw validationError(fields);
      const ts = nowIso();
      const category: FinancialCategory = {
        id: newId(),
        organizationId: store.organization.id,
        type: payload.type,
        name,
        status: "active",
        createdAt: ts,
        updatedAt: ts,
      };

      if (isSupabaseOrganization(store.organization.id)) {
        await createFinancialCategoryInDb(category);
      }

      store.financialCategories.push(category);
      auditLogService.record({
        action: "created",
        target: { type: "financial_category", id: category.id, label: category.name },
        predicate: `criou a categoria de ${financialEntryTypeLabel(category.type).toLowerCase()} ${category.name}`,
      });
      return clone(category);
    });
  },

  /** Renomeia, inativa ou reativa. Categorias de sistema ficam travadas. */
  updateCategory(id: Id, payload: UpdateFinancialCategory): Promise<FinancialCategory> {
    return simulateWrite(async () => {
      const idx = store.financialCategories.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError("Categoria não encontrada.");
      const current = store.financialCategories[idx];
      if (current.system) {
        throw conflict("Categoria do sistema não pode ser renomeada nem inativada.");
      }
      const fields: ApiErrorField[] = [];
      let name = current.name;
      if (payload.name !== undefined) {
        name = payload.name.trim();
        if (!name) fields.push({ field: "name", message: "Informe o nome da categoria." });
        else if (name.length > 60) fields.push({ field: "name", message: "Use no máximo 60 caracteres." });
        else if (isDuplicateCategory(current.type, name, id)) {
          fields.push({ field: "name", message: "Já existe uma categoria com esse nome." });
        }
      }
      if (payload.status !== undefined && payload.status !== "active" && payload.status !== "inactive") {
        fields.push({ field: "status", message: "Status inválido." });
      }
      if (fields.length > 0) throw validationError(fields);
      const updated: FinancialCategory = {
        ...current,
        name,
        status: payload.status ?? current.status,
        updatedAt: nowIso(),
      };

      if (isSupabaseOrganization(store.organization.id)) {
        await updateFinancialCategoryInDb(id, payload, store.organization.id);
      }

      store.financialCategories[idx] = updated;
      const reactivated = current.status !== "active" && updated.status === "active";
      const inactivated = current.status === "active" && updated.status !== "active";
      auditLogService.record({
        action: reactivated ? "activated" : inactivated ? "inactivated" : "updated",
        target: { type: "financial_category", id, label: updated.name },
        predicate: `${reactivated ? "reativou" : inactivated ? "inativou" : "atualizou"} a categoria financeira ${updated.name}`,
        changes:
          current.name !== updated.name
            ? [{ field: "name", label: "Nome", before: current.name, after: updated.name }]
            : undefined,
      });
      return clone(updated);
    });
  },
};
