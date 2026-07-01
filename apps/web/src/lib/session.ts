/**
 * Sessao mockada do MVP (sem auth real). O cookie guarda o `userId` do usuario
 * "logado"; a guarda de rota vive em `src/proxy.ts` (presenca do cookie) e o
 * RBAC de rota no layout server (getCurrentUser + requirePermission). Na fase de
 * backend isto vira um token assinado resolvido no servidor, sem mudar as telas.
 */
export const SESSION_COOKIE = "gestarahub_session";

// Duracao do cookie (7 dias).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
