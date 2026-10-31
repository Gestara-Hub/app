import type { UserView } from "@gestarahub/contracts";

/**
 * Sessao mockada do MVP (sem auth real). O cookie guarda o snapshot do usuario
 * "logado" (as "claims"), nao so o `userId`. Motivo: os usuarios criados na UI
 * vivem apenas no store do navegador (localStorage) — o servidor so enxerga o
 * seed. Buscar por id no server falharia para esses usuarios; carregar as claims
 * no proprio cookie desacopla a sessao do store. A guarda de rota vive em
 * `src/proxy.ts` (presenca do cookie) e o RBAC no layout server (getCurrentUser
 * + requirePermission). Desde 30/10/2026 o cookie e assinado no servidor
 * (`lib/session-cookie.ts`): claims forjadas nao valem.
 */
export const SESSION_COOKIE = "gestarahub_session";

// Duracao do cookie (7 dias).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Claims da sessao: o `UserView` do usuario logado (perfil ja resolvido). */
export type SessionClaims = UserView;

// Gravar e ler o cookie (assinado): `lib/session-cookie.ts`, so do servidor.

export function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Sanitiza o destino pos-login (`?from=`): aceita so caminho relativo do proprio
 * app ("/x?y"). Barra "//host", "/\host", esquema ("https:", "javascript:") e
 * caracteres de controle (open redirect). Retorna undefined se invalido.
 */
export function safeRedirectPath(from: unknown): string | undefined {
  if (typeof from !== "string" || from.length === 0 || from.length > 2048) {
    return undefined;
  }
  if (!from.startsWith("/") || from.startsWith("//")) return undefined;
  // Barra invertida vira "/" em alguns navegadores ("/\evil.com" = "//evil.com").
  if (from.includes("\\")) return undefined;
  for (let i = 0; i < from.length; i++) {
    const code = from.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return undefined;
  }
  try {
    const base = "http://gestarahub.local";
    const url = new URL(from, base);
    if (url.origin !== base) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSupabaseOrganization(organizationId: string | undefined): boolean {
  return Boolean(organizationId && UUID_RE.test(organizationId));
}
