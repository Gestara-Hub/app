import type {
  ApiErrorField,
  CreateRole,
  Id,
  Role,
  RoleFilter,
  UpdateRole,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { isSupabaseOrganization } from "@/lib/session";
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
import {
  createRoleInDb,
  listRolesFromDb,
  updateRoleInDb,
  type RoleWriteResult,
} from "./rolesBackend";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cargo não encontrado.";
const DUPLICATE_NAME = "Já existe um cargo com esse nome.";

function isRealAccount(): boolean {
  return isSupabaseOrganization(store.organization.id);
}

/** Resultado do banco: nome repetido vira erro de campo. */
function unwrap(result: RoleWriteResult): Role {
  if ("duplicate" in result) {
    throw validationError([{ field: "name", message: DUPLICATE_NAME }]);
  }
  return result.role;
}

/**
 * Conta real: os cargos vivem na tabela `roles` (doc 15, fatia 1) e o store e
 * so cache (a Equipe le o nome do cargo dele). Cargo criado antes so no
 * navegador sobe uma vez para o banco; nome repetido fica com o do banco.
 */
export async function syncRolesFromDb(): Promise<void> {
  if (!isRealAccount()) return;
  const organizationId = store.organization.id;
  let roles = await listRolesFromDb(organizationId);
  const known = new Set(roles.map((r) => r.id));
  const localOnly = store.roles.filter((r) => !known.has(r.id));
  if (localOnly.length > 0) {
    for (const role of localOnly) await createRoleInDb({ ...role, organizationId });
    roles = await listRolesFromDb(organizationId);
  }
  store.roles = roles;
}

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
    return simulateRead(async () => {
      await syncRolesFromDb();
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
    return simulateRead(async () => {
      await syncRolesFromDb();
      const found = store.roles.find((r) => r.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateRole): Promise<Role> {
    return simulateWrite(async () => {
      validateRole(payload, { partial: false });
      if (isDuplicateName(payload.name)) {
        throw validationError([
          { field: "name", message: DUPLICATE_NAME },
        ]);
      }
      const ts = nowIso();
      const nextPosition =
        payload.position ??
        Math.max(0, ...store.roles.map((r) => r.position)) + 1;
      let role: Role = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        position: nextPosition,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      if (isRealAccount()) role = unwrap(await createRoleInDb(role));
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
    return simulateWrite(async () => {
      const idx = store.roles.findIndex((r) => r.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateRole(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) {
        throw validationError([
          { field: "name", message: DUPLICATE_NAME },
        ]);
      }
      const current = store.roles[idx];
      let updated: Role = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        updatedAt: nowIso(),
      };
      if (isRealAccount()) {
        updated = unwrap(
          await updateRoleInDb(id, store.organization.id, {
            name: updated.name,
            position: updated.position,
            status: updated.status,
          }),
        );
      }
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
    return simulateWrite(async () => {
      const idx = store.roles.findIndex((r) => r.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const name = store.roles[idx].name;
      store.roles[idx] = isRealAccount()
        ? unwrap(await updateRoleInDb(id, store.organization.id, { status: "inactive" }))
        : { ...store.roles[idx], status: "inactive", updatedAt: nowIso() };
      auditLogService.record({
        action: "inactivated",
        target: { type: "role", id, label: name },
        predicate: `inativou o cargo ${name}`,
      });
    });
  },
};
