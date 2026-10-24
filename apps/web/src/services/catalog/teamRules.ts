import type {
  ApiErrorField,
  CreateProfessional,
  CreateRole,
  Professional,
  ProfessionalView,
  Role,
} from "@gestarahub/contracts";
import { validationError } from "@gestarahub/core/api-error";

/**
 * Regras da equipe e dos cargos, sem store nem banco (doc 15, fatia 2.1): a
 * demonstracao roda sobre o store e a conta real na server action.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ROLE_NOT_FOUND = "Cargo não encontrado.";
export const PROFESSIONAL_NOT_FOUND = "Cadastro não encontrado.";

export function duplicateRoleNameError() {
  return validationError([{ field: "name", message: "Já existe um cargo com esse nome." }]);
}

export function validateRolePayload(payload: Partial<CreateRole>, { partial }: { partial: boolean }): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateRole) => Object.prototype.hasOwnProperty.call(payload, key);
  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome do cargo." });
    }
  }
  if (fields.length > 0) throw validationError(fields);
}

export function sortRoles(list: Role[]): Role[] {
  return [...list].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"));
}

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Equipe for feito.
export function validateProfessionalPayload(
  payload: Partial<CreateProfessional>,
  { partial, roleExists }: { partial: boolean; roleExists: (roleId: string) => boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateProfessional) => Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome." });
    }
  }
  // Cargo e opcional; se informado, precisa existir.
  if (has("roleId") && payload.roleId && !roleExists(payload.roleId)) {
    fields.push({ field: "roleId", message: "Cargo inválido." });
  }
  // Email e opcional; se informado, formato precisa ser valido.
  if (has("email") && payload.email) {
    const trimmedEmail = payload.email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      fields.push({ field: "email", message: "Informe um e-mail válido." });
    }
  }
  if (fields.length > 0) throw validationError(fields);
}

// Expande o cargo (roleId -> role), como o join do GET.
// Cargo e opcional: sem roleId, o profissional nao tem `role`.
export function toProfessionalView(p: Professional, roles: Pick<Role, "id" | "name">[]): ProfessionalView {
  const name = p.roleId ? (roles.find((r) => r.id === p.roleId)?.name ?? "") : "";
  return { ...p, role: p.roleId ? { id: p.roleId, name } : undefined };
}

export function sortProfessionals<T extends Pick<Professional, "name">>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
