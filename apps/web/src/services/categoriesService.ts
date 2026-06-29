import type {
  ApiErrorField,
  Category,
  CategoryFilter,
  CreateCategory,
  Id,
  UpdateCategory,
} from "@/types";
import { store } from "@/mocks/store";
import { normalizeText } from "@/lib/text";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Categoria não encontrada.";

// Nome de categoria e unico por organizacao (match accent/case-insensitive).
function isDuplicateName(name: string, excludeId?: Id): boolean {
  const target = normalizeText(name);
  return store.categories.some(
    (c) => c.id !== excludeId && normalizeText(c.name) === target,
  );
}

function validateCategory(
  payload: Partial<CreateCategory>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateCategory) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome da categoria." });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

function sortCategories(list: Category[]): Category[] {
  return [...list].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export const categoriesService = {
  list(filter?: CategoryFilter): Promise<Category[]> {
    return simulateRead(() => {
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
    return simulateRead(() => {
      const found = store.categories.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateCategory): Promise<Category> {
    return simulateWrite(() => {
      validateCategory(payload, { partial: false });
      if (isDuplicateName(payload.name)) {
        throw validationError([
          { field: "name", message: "Já existe uma categoria com esse nome." },
        ]);
      }
      const ts = nowIso();
      const nextPosition =
        payload.position ??
        Math.max(0, ...store.categories.map((c) => c.position)) + 1;
      const category: Category = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        position: nextPosition,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.categories.push(category);
      return clone(category);
    });
  },

  update(id: Id, payload: UpdateCategory): Promise<Category> {
    return simulateWrite(() => {
      const idx = store.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateCategory(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) {
        throw validationError([
          { field: "name", message: "Já existe uma categoria com esse nome." },
        ]);
      }
      const current = store.categories[idx];
      const updated: Category = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        updatedAt: nowIso(),
      };
      store.categories[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica; categoria inativa nao e sugerida em novos servicos.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.categories[idx] = {
        ...store.categories[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
    });
  },
};
