import type {
  Category,
  CategoryFilter,
  CreateCategory,
  Id,
  UpdateCategory,
} from "@gestarahub/contracts";
import { store } from "@/services/world/store";
import { normalizeText } from "@/lib/text";
import { plural } from "@gestarahub/core/format";
import {
  newId,
  notFoundError,
  nowIso,
  readOp,
  writeOp,
  textIncludes,
} from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { categoryNoun } from "../world/nouns";
import { realAccountInBrowser } from "../world/delegate";
import { unwrap } from "../server/action";
import {
  createCategoryAction,
  getCategoryAction,
  listCategoriesAction,
  removeCategoryAction,
  updateCategoryAction,
} from "./categoriesActions";
import {
  defaultAssessmentsForNewModality,
  duplicateCategoryNameError,
  normalizedAssessments,
  normalizedMeasurements,
  resetMissingLevels,
  sortCategories,
  validateCategoryPayload,
  assertGradingKept,
} from "./categoryRules";
import { encodeArgs } from "../world/transport";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Modalidades (categorias). Conta real: le e grava pelo servidor
 * (`catalog/categoriesActions`, doc 15, fatia 2.1). Demonstracao: store.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Categoria não encontrada.";

function isRealAccount(): boolean {
  return realAccountInBrowser();
}

/**
 * Transicao (doc 15, fatia 2): turmas, alunos e relatorios ainda montam as
 * telas no navegador a partir do store. Ate migrarem, a conta real mantem la
 * uma copia das modalidades lidas do banco. Sai na fatia 4.
 */
function cacheCategories(categories: Category[]): void {
  const ids = new Set(categories.map((c) => c.id));
  store.categories = [...store.categories.filter((c) => !ids.has(c.id)), ...categories];
}

// Nome de categoria e unico por organizacao (match accent/case-insensitive).
function isDuplicateName(name: string, excludeId?: Id): boolean {
  const target = normalizeText(name);
  return store.categories.some(
    (c) => c.id !== excludeId && normalizeText(c.name) === target,
  );
}

function validateCategory(payload: Partial<CreateCategory>, { partial }: { partial: boolean }): void {
  validateCategoryPayload(payload, { partial, noun: categoryNoun() });
}

function recordUpdate(updated: Category, reset: number): void {
  auditLogService.record({
    action: updated.status === "active" ? "updated" : "inactivated",
    target: { type: "category", id: updated.id, label: updated.name },
    predicate: `atualizou a ${categoryNoun()} ${updated.name}${reset > 0 ? ` (${plural(reset, "aluno voltou", "alunos voltaram")} ao primeiro nível da nova trilha)` : ""}`,
  });
}

export const categoriesService = {
  list(filter?: CategoryFilter): Promise<Category[]> {
    return readOp(async () => {
      if (isRealAccount()) {
        const categories = await unwrap(listCategoriesAction(filter));
        if (!filter?.search && !filter?.status) cacheCategories(categories);
        return categories;
      }

      let result = store.categories;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((c) => textIncludes(c.name, term));
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(sortCategories(result));
    });
  },

  getById(id: Id): Promise<Category> {
    return readOp(async () => {
      if (isRealAccount()) return unwrap(getCategoryAction(id));
      const found = store.categories.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateCategory): Promise<Category> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const created = await unwrap(createCategoryAction(payload));
        cacheCategories([created]);
        auditLogService.record({
          action: "created",
          target: { type: "category", id: created.id, label: created.name },
          predicate: `criou a ${categoryNoun()} ${created.name}`,
        });
        return created;
      }

      validateCategory(payload, { partial: false });
      if (isDuplicateName(payload.name)) throw duplicateCategoryNameError(categoryNoun());
      const ts = nowIso();
      const nextPosition =
        payload.position ??
        Math.max(0, ...store.categories.map((c) => c.position)) + 1;
      const assessments = payload.assessments
        ? normalizedAssessments(payload)
        : defaultAssessmentsForNewModality(store.organization);
      const category: Category = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        position: nextPosition,
        progressionTrack: payload.progressionTrack,
        ...(assessments ? { assessments } : {}),
        ...(payload.measurements ? { measurements: normalizedMeasurements(payload) } : {}),
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.categories.push(category);
      auditLogService.record({
        action: "created",
        target: { type: "category", id: category.id, label: category.name },
        predicate: `criou a ${categoryNoun()} ${category.name}`,
      });
      return clone(category);
    });
  },

  update(id: Id, payload: UpdateCategory): Promise<Category> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const { category, reset } = await unwrap(updateCategoryAction(id, encodeArgs(payload) as typeof payload));
        cacheCategories([category]);
        // O servidor ja marcou; a copia do espaco no navegador acompanha.
        const settings = store.organization.settings;
        if (settings?.modalitiesReviewed === false && (payload.name !== undefined || payload.progressionTrack !== undefined)) {
          store.organization.settings = { ...settings, modalitiesReviewed: true };
        }
        recordUpdate(category, reset);
        return category;
      }

      const idx = store.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateCategory(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) {
        throw duplicateCategoryNameError(categoryNoun());
      }
      const current = store.categories[idx];
      if (payload.assessments !== undefined) {
        const hasGrades = (store.assessments ?? []).some((a) => a.modalityId === id && a.grades.length > 0);
        assertGradingKept(current.assessments, normalizedAssessments(payload), hasGrades);
      }
      const updated: Category = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        ...(payload.assessments !== undefined ? { assessments: normalizedAssessments(payload) } : {}),
        ...(payload.measurements !== undefined ? { measurements: normalizedMeasurements(payload) } : {}),
        updatedAt: nowIso(),
      };
      store.categories[idx] = updated;

      const reset =
        payload.progressionTrack !== undefined
          ? resetMissingLevels(store.clients, updated, dateInSpace(), nowIso()).reset
          : 0;
      const settings = store.organization.settings;
      if (
        settings?.modalitiesReviewed === false &&
        (payload.name !== undefined || payload.progressionTrack !== undefined)
      ) {
        store.organization.settings = { ...settings, modalitiesReviewed: true };
      }
      recordUpdate(updated, reset);
      return clone(updated);
    });
  },

  // remove = inativacao logica; categoria inativa nao e sugerida em novos servicos.
  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      let name: string;
      if (isRealAccount()) {
        const removed = await unwrap(removeCategoryAction(id));
        cacheCategories([removed]);
        name = removed.name;
      } else {
        const idx = store.categories.findIndex((c) => c.id === id);
        if (idx === -1) throw notFoundError(NOT_FOUND);
        name = store.categories[idx].name;
        store.categories[idx] = {
          ...store.categories[idx],
          status: "inactive",
          updatedAt: nowIso(),
        };
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "category", id, label: name },
        predicate: `inativou a ${categoryNoun()} ${name}`,
      });
    });
  },
};
