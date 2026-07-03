import type {
  ApiError,
  ApiErrorField,
  CreateUser,
  Id,
  UpdateUser,
  User,
  UserFilter,
  UserView,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Usuário não encontrado.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Expande o profissional vinculado (espelha o join que a API faria no GET).
function toView(u: User): UserView {
  const p = u.professionalId
    ? store.professionals.find((x) => x.id === u.professionalId)
    : undefined;
  return {
    ...u,
    professional: p ? { id: p.id, name: p.name, status: p.status } : undefined,
  };
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
      return clone(toView(updated));
    });
  },

  // remove = inativacao logica; usuario inativo nao pode logar nem e sugerido.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      ensureNotLastOwner(store.users[idx], { status: "inactive" });
      store.users[idx] = {
        ...store.users[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
    });
  },
};
