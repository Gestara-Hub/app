import type {
ApiError,
ApiErrorField,CreateUser,
Id,
Professional,User,UserView
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
apiError,validationError
} from "@/services/world/ops";
import { getCurrentActor } from "@/services/world/actor";

/**
 * Regras de usuarios: validacao, e-mail unico, profissional livre e protecao do ultimo dono.
 */

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export const NOT_FOUND = "Usuário não encontrado.";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Expande o profissional vinculado (espelha o join que a API faria no GET).
// Parametrizado pelos profissionais de um tenant especifico — o login/troca
// (cross-tenant) precisa expandir usuarios de outra org, nao so a ativa.
export function toViewWith(professionals: Professional[], u: User): UserView {
  const p = u.professionalId
    ? professionals.find((x) => x.id === u.professionalId)
    : undefined;
  return {
    ...u,
    professional: p ? { id: p.id, name: p.name, status: p.status } : undefined,
  };
}

export function toView(u: User): UserView {
  return toViewWith(store.professionals, u);
}

/** Opcao de login/troca de usuario (demo), com a organizacao (tenant) do usuario. */
export interface UserSwitchOption {
  user: UserView;
  organizationId: Id;
  organizationName: string;
  onboardingCompleted?: boolean;
}

export function validateUser(
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
export function ensureEmailUnique(email: string, exceptId?: Id): void {
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

/**
 * Um profissional da equipe tem um usuario ativo so (antes dava para ligar
 * dois e o escopo do professor ficava ambiguo). Usuario inativo libera.
 */
export function ensureProfessionalFree(
  professionalId: Id | undefined,
  status: User["status"],
  exceptId?: Id,
): void {
  if (!professionalId || status !== "active") return;
  const clash = store.users.find(
    (u) => u.id !== exceptId && u.status === "active" && u.professionalId === professionalId,
  );
  if (clash) {
    throw validationError([
      { field: "professionalId", message: `Este profissional já está ligado ao usuário ${clash.name}.` },
    ]);
  }
}

export function activeOwnerCount(): number {
  return store.users.filter((u) => u.profile === "owner" && u.status === "active")
    .length;
}

export function lastOwnerError(): ApiError {
  return apiError(
    "VALIDATION",
    "Não é possível inativar ou rebaixar o último proprietário ativo.",
    { httpStatus: 422 },
  );
}

// Impede deixar a organizacao sem nenhum proprietario ativo.
export function ensureNotLastOwner(current: User, next: Partial<CreateUser>): void {
  const wasActiveOwner = current.profile === "owner" && current.status === "active";
  if (!wasActiveOwner || activeOwnerCount() > 1) return;
  const losesOwner =
    (next.profile !== undefined && next.profile !== "owner") ||
    next.status === "inactive";
  if (losesOwner) throw lastOwnerError();
}

// Ninguem muda o proprio perfil nem o proprio status (a UI ja trava; aqui e a
// regra no "servidor", como o backend real faria pelo ator do token).
export function ensureNotSelfPrivilegeChange(current: User, next: Partial<CreateUser>): void {
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
