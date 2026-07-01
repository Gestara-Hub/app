import type { User } from "@/types";

/**
 * Escopo de dados do perfil Profissional: quando o usuario e "professional" e
 * esta vinculado a um profissional, a Agenda/Agendamentos filtram para o
 * `professionalId` dele. Demais perfis nao escopam (veem todos). Scoping e
 * UI-only no mock (os services ainda retornam tudo) — server-side fica pra fase
 * de backend.
 */
export function scopedProfessionalId(
  user: Pick<User, "profile" | "professionalId">,
): string | undefined {
  return user.profile === "professional" ? user.professionalId : undefined;
}
