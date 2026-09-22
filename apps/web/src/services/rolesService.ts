import type {
  ApiErrorField,
  CreateRole,
  Id,
  Role,
  RoleFilter,
  UpdateRole,
} from "@gestarahub/contracts";
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
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cargo não encontrado.";

// Nome de cargo e unico por organizacao (match accent/case-insensitive).
function isDuplicateName(name: string, excludeId?: Id): boolean {
  const target = normalizeText(name);
  return store.roles.some(
    (r) => r.id !== excludeId && normalizeText(r.name) === target,
  );
}

function validateRole(
  payload: Partial<CreateRole>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateRole) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome do cargo." });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

function sortRoles(list: Role[]): Role[] {
  return [...list].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export const rolesService = {
  list(filter?: RoleFilter): Promise<Role[]> {
    return simulateRead(() => {
      let result = store.roles;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((r) => textIncludes(r.name, term));
      }
      if (filter?.status) {
        result = result.filter((r) => r.status === filter.status);
      }
      return clone(sortRoles(result));
    });
  },

  getById(id: Id): Promise<Role> {
    return simulateRead(() => {
      const found = store.roles.find((r) => r.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateRole): Promise<Role> {
    return simulateWrite(() => {
      validateRole(payload, { partial: false });
      if (isDuplicateName(payload.name)) {
        throw validationError([
          { field: "name", message: "Já existe um cargo com esse nome." },
        ]);
      }
      const ts = nowIso();
      const nextPosition =
        payload.position ??
        Math.max(0, ...store.roles.map((r) => r.position)) + 1;
      const role: Role = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        position: nextPosition,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.roles.push(role);
      auditLogService.record({
        action: "created",
        target: { type: "role", id: role.id, label: role.name },
        predicate: `criou o cargo ${role.name}`,
      });
      return clone(role);
    });
  },

  update(id: Id, payload: UpdateRole): Promise<Role> {
    return simulateWrite(() => {
      const idx = store.roles.findIndex((r) => r.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateRole(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) {
        throw validationError([
          { field: "name", message: "Já existe um cargo com esse nome." },
        ]);
      }
      const current = store.roles[idx];
      const updated: Role = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        updatedAt: nowIso(),
      };
      store.roles[idx] = updated;
      auditLogService.record({
        action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
        target: { type: "role", id: updated.id, label: updated.name },
        predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o cargo ${updated.name}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; cargo inativo nao e sugerido em novos cadastros.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.roles.findIndex((r) => r.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const name = store.roles[idx].name;
      store.roles[idx] = {
        ...store.roles[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "role", id, label: name },
        predicate: `inativou o cargo ${name}`,
      });
    });
  },
};
