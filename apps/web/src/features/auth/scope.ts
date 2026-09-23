import type { User } from "@gestarahub/contracts";

/**
 * Id sentinela do escopo "nenhum profissional": perfil Profissional SEM vinculo.
 * Nao casa com nenhum registro, entao filtros por `professionalId` voltam vazios
 * (fail-closed) em vez de mostrar a agenda de todos.
 */
export const UNLINKED_PROFESSIONAL_ID = "__unlinked-professional__";

/**
 * Escopo de dados do perfil Profissional: quando o usuario e "professional", a
 * Agenda/Agendamentos filtram para o `professionalId` dele; sem vinculo, filtram
 * para nada (`UNLINKED_PROFESSIONAL_ID`). Demais perfis nao escopam (veem
 * todos). Scoping e UI-only no mock (os services ainda retornam tudo) —
 * server-side fica pra fase de backend.
 */
export function scopedProfessionalId(
  user: Pick<User, "profile" | "professionalId">,
): string | undefined {
  if (user.profile !== "professional") return undefined;
  return user.professionalId || UNLINKED_PROFESSIONAL_ID;
}

/** Perfil Profissional sem vinculo com a equipe (escopo vazio; avisar na UI). */
export function isUnlinkedProfessional(
  user: Pick<User, "profile" | "professionalId">,
): boolean {
  return user.profile === "professional" && !user.professionalId;
}
