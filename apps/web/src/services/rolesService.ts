import type { CreateRole, Id, Role, RoleFilter, UpdateRole } from "@gestarahub/contracts";
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
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";
import { unwrap } from "./server/action";
import {
  createRoleAction,
  getRoleAction,
  listRolesAction,
  removeRoleAction,
  updateRoleAction,
} from "./catalog/teamActions";
import {
  duplicateRoleNameError,
  ROLE_NOT_FOUND,
  sortRoles,
  validateRolePayload,
} from "./catalog/teamRules";

/**
 * Cargos da equipe. Conta real: tabela `roles` pelo servidor
 * (`catalog/teamActions`, doc 15, fatia 2.1). Demonstracao: store.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRealAccount(): boolean {
  return isSupabaseOrganization(store.organization.id);
}

/**
 * Transicao (doc 15, fatia 2): telas ainda montadas no navegador leem o nome
 * do cargo no store. Ate migrarem, a conta real mantem la uma copia. Sai na
 * fatia 4.
 */
export function cacheRoles(roles: Role[]): void {
  const ids = new Set(roles.map((r) => r.id));
  store.roles = [...store.roles.filter((r) => !ids.has(r.id)), ...roles];
}

// Nome de cargo e unico por organizacao (match accent/case-insensitive).
function isDuplicateName(name: string, excludeId?: Id): boolean {
  const target = normalizeText(name);
  return store.roles.some((r) => r.id !== excludeId && normalizeText(r.name) === target);
}

function recordUpdate(updated: Role, previousStatus: Role["status"]): void {
  const reactivated = previousStatus !== "active" && updated.status === "active";
  auditLogService.record({
    action: reactivated ? "activated" : "updated",
    target: { type: "role", id: updated.id, label: updated.name },
    predicate: `${reactivated ? "reativou" : "atualizou"} o cargo ${updated.name}`,
  });
}

export const rolesService = {
  list(filter?: RoleFilter): Promise<Role[]> {
    return simulateRead(async () => {
      if (isRealAccount()) {
        const roles = await unwrap(listRolesAction(filter));
        if (!filter?.search && !filter?.status) cacheRoles(roles);
        return roles;
      }
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
      if (isRealAccount()) return unwrap(getRoleAction(id));
      const found = store.roles.find((r) => r.id === id);
      if (!found) throw notFoundError(ROLE_NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateRole): Promise<Role> {
    return simulateWrite(async () => {
      let role: Role;
      if (isRealAccount()) {
        role = await unwrap(createRoleAction(payload));
        cacheRoles([role]);
      } else {
        validateRolePayload(payload, { partial: false });
        if (isDuplicateName(payload.name)) throw duplicateRoleNameError();
        const ts = nowIso();
        role = {
          id: newId(),
          organizationId: store.organization.id,
          name: payload.name.trim(),
          position: payload.position ?? Math.max(0, ...store.roles.map((r) => r.position)) + 1,
          status: payload.status ?? "active",
          createdAt: ts,
          updatedAt: ts,
        };
        store.roles.push(role);
      }
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
      if (isRealAccount()) {
        const { role, previousStatus } = await unwrap(updateRoleAction(id, payload));
        cacheRoles([role]);
        recordUpdate(role, previousStatus);
        return role;
      }
      const idx = store.roles.findIndex((r) => r.id === id);
      if (idx === -1) throw notFoundError(ROLE_NOT_FOUND);
      validateRolePayload(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) throw duplicateRoleNameError();
      const current = store.roles[idx];
      const updated: Role = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        updatedAt: nowIso(),
      };
      store.roles[idx] = updated;
      recordUpdate(updated, current.status);
      return clone(updated);
    });
  },

  // remove = inativacao logica; cargo inativo nao e sugerido em novos cadastros.
  remove(id: Id): Promise<void> {
    return simulateWrite(async () => {
      let name: string;
      if (isRealAccount()) {
        const removed = await unwrap(removeRoleAction(id));
        cacheRoles([removed]);
        name = removed.name;
      } else {
        const idx = store.roles.findIndex((r) => r.id === id);
        if (idx === -1) throw notFoundError(ROLE_NOT_FOUND);
        name = store.roles[idx].name;
        store.roles[idx] = { ...store.roles[idx], status: "inactive", updatedAt: nowIso() };
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "role", id, label: name },
        predicate: `inativou o cargo ${name}`,
      });
    });
  },
};
