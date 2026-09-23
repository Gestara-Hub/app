import type {
  ApiError,
  ApiErrorField,
  AuditChange,
  CreateUser,
  Id,
  Professional,
  UpdateUser,
  User,
  UserFilter,
  UserView,
} from "@gestarahub/contracts";
import { allTenants, store } from "@/mocks/store";
import { userProfileLabel } from "@/lib/labels";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { getCurrentActor } from "@/mocks/currentActor";
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Usuário não encontrado.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Expande o profissional vinculado (espelha o join que a API faria no GET).
// Parametrizado pelos profissionais de um tenant especifico — o login/troca
// (cross-tenant) precisa expandir usuarios de outra org, nao so a ativa.
function toViewWith(professionals: Professional[], u: User): UserView {
  const p = u.professionalId
    ? professionals.find((x) => x.id === u.professionalId)
    : undefined;
  return {
    ...u,
    professional: p ? { id: p.id, name: p.name, status: p.status } : undefined,
  };
}

function toView(u: User): UserView {
  return toViewWith(store.professionals, u);
}

/** Opcao de login/troca de usuario (demo), com a organizacao (tenant) do usuario. */
export interface UserSwitchOption {
  user: UserView;
  organizationId: Id;
  organizationName: string;
}

function validateUser(
  payload: Partial<CreateUser>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateUser) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome." });
    }
  }
  if (!partial || has("email")) {
    if (!payload.email || !payload.email.trim()) {
      fields.push({ field: "email", message: "Informe o e-mail." });
    } else if (!EMAIL_RE.test(payload.email.trim())) {
      fields.push({ field: "email", message: "Informe um e-mail válido." });
    }
  }
  if (!partial || has("profile")) {
    if (!payload.profile) {
      fields.push({ field: "profile", message: "Selecione o perfil." });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

// E-mail unico por organizacao (match case-insensitive).
function ensureEmailUnique(email: string, exceptId?: Id): void {
  const norm = email.trim().toLowerCase();
  const clash = store.users.some(
    (u) => u.id !== exceptId && u.email.trim().toLowerCase() === norm,
  );
  if (clash) {
    throw validationError([
      { field: "email", message: "Já existe um usuário com este e-mail." },
    ]);
  }
}

function activeOwnerCount(): number {
  return store.users.filter((u) => u.profile === "owner" && u.status === "active")
    .length;
}

function lastOwnerError(): ApiError {
  return apiError(
    "VALIDATION",
    "Não é possível inativar ou rebaixar o último proprietário ativo.",
    { httpStatus: 422 },
  );
}

// Impede deixar a organizacao sem nenhum proprietario ativo.
function ensureNotLastOwner(current: User, next: Partial<CreateUser>): void {
  const wasActiveOwner = current.profile === "owner" && current.status === "active";
  if (!wasActiveOwner || activeOwnerCount() > 1) return;
  const losesOwner =
    (next.profile !== undefined && next.profile !== "owner") ||
    next.status === "inactive";
  if (losesOwner) throw lastOwnerError();
}

// Ninguem muda o proprio perfil nem o proprio status (a UI ja trava; aqui e a
// regra no "servidor", como o backend real faria pelo ator do token).
function ensureNotSelfPrivilegeChange(current: User, next: Partial<CreateUser>): void {
  if (getCurrentActor()?.userId !== current.id) return;
  const changesProfile = next.profile !== undefined && next.profile !== current.profile;
  const changesStatus = next.status !== undefined && next.status !== current.status;
  if (changesProfile || changesStatus) {
    throw validationError([
      {
        field: changesProfile ? "profile" : "status",
        message: "Você não pode alterar o seu próprio perfil ou status.",
      },
    ]);
  }
}

export const usersService = {
  list(filter?: UserFilter): Promise<UserView[]> {
    return simulateRead(() => {
      let result = store.users;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (u) => textIncludes(u.name, term) || textIncludes(u.email, term),
        );
      }
      if (filter?.status) {
        result = result.filter((u) => u.status === filter.status);
      }
      if (filter?.profile) {
        result = result.filter((u) => u.profile === filter.profile);
      }
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toView),
      );
    });
  },

  // Usuarios ATIVOS de TODOS os tenants (cross-tenant), para o login e o
  // "trocar usuario" do demo — escolher um usuario de outra org troca o tenant.
  listForSwitch(): Promise<UserSwitchOption[]> {
    return simulateRead(() => {
      const options: UserSwitchOption[] = [];
      for (const tenant of allTenants()) {
        for (const u of tenant.users) {
          if (u.status !== "active") continue;
          options.push({
            user: toViewWith(tenant.professionals, u),
            organizationId: tenant.organization.id,
            organizationName: tenant.organization.name,
          });
        }
      }
      return clone(
        options.sort(
          (a, b) =>
            a.organizationName.localeCompare(b.organizationName, "pt-BR") ||
            a.user.name.localeCompare(b.user.name, "pt-BR"),
        ),
      );
    });
  },

  getById(id: Id): Promise<UserView> {
    return simulateRead(() => {
      const found = store.users.find((u) => u.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(toView(found));
    });
  },

  create(payload: CreateUser): Promise<UserView> {
    return simulateWrite(() => {
      validateUser(payload, { partial: false });
      ensureEmailUnique(payload.email);
      const ts = nowIso();
      const user: User = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        email: payload.email.trim(),
        profile: payload.profile,
        professionalId: payload.professionalId || undefined,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.users.push(user);
      auditLogService.record({
        action: "created",
        target: { type: "user", id: user.id, label: user.name, profile: user.profile },
        predicate: `criou o usuário ${user.name} (${userProfileLabel(user.profile)})`,
        security: true,
      });
      return clone(toView(user));
    });
  },

  update(id: Id, payload: UpdateUser): Promise<UserView> {
    return simulateWrite(() => {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateUser(payload, { partial: true });
      if (payload.email !== undefined) ensureEmailUnique(payload.email, id);
      const current = store.users[idx];
      ensureNotSelfPrivilegeChange(current, payload);
      ensureNotLastOwner(current, payload);
      const updated: User = {
        ...current,
        ...payload,
        name: payload.name?.trim() ?? current.name,
        email: payload.email?.trim() ?? current.email,
        professionalId: Object.prototype.hasOwnProperty.call(
          payload,
          "professionalId",
        )
          ? payload.professionalId || undefined
          : current.professionalId,
        updatedAt: nowIso(),
      };
      store.users[idx] = updated;
      const changes: AuditChange[] = [];
      if (updated.profile !== current.profile) {
        changes.push({
          field: "profile",
          label: "Perfil",
          before: userProfileLabel(current.profile),
          after: userProfileLabel(updated.profile),
        });
      }
      const reactivated = current.status === "inactive" && updated.status === "active";
      const inactivated = current.status === "active" && updated.status === "inactive";
      const action = reactivated ? "activated" : inactivated ? "inactivated" : "updated";
      const verb = reactivated ? "reativou" : inactivated ? "inativou" : "atualizou";
      auditLogService.record({
        action,
        target: { type: "user", id: updated.id, label: updated.name, profile: updated.profile },
        predicate: `${verb} o usuário ${updated.name}`,
        changes,
        security: true,
      });
      return clone(toView(updated));
    });
  },

  // remove = inativacao logica; usuario inativo nao pode logar nem e sugerido.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      ensureNotSelfPrivilegeChange(store.users[idx], { status: "inactive" });
      ensureNotLastOwner(store.users[idx], { status: "inactive" });
      const target = store.users[idx];
      store.users[idx] = {
        ...store.users[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "user", id, label: target.name, profile: target.profile },
        predicate: `inativou o usuário ${target.name}`,
        security: true,
      });
    });
  },
};
