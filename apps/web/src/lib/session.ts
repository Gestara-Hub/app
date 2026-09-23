import type { UserView } from "@gestarahub/contracts";

/**
 * Sessao mockada do MVP (sem auth real). O cookie guarda o snapshot do usuario
 * "logado" (as "claims"), nao so o `userId`. Motivo: os usuarios criados na UI
 * vivem apenas no store do navegador (localStorage) — o servidor so enxerga o
 * seed. Buscar por id no server falharia para esses usuarios; carregar as claims
 * no proprio cookie desacopla a sessao do store. A guarda de rota vive em
 * `src/proxy.ts` (presenca do cookie) e o RBAC no layout server (getCurrentUser
 * + requirePermission). Na fase de backend isto vira um token assinado (JWT com
 * as mesmas claims) resolvido no servidor, sem mudar as telas.
 */
export const SESSION_COOKIE = "gestarahub_session";

// Duracao do cookie (7 dias).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Claims da sessao: o `UserView` do usuario logado (perfil ja resolvido). */
export type SessionClaims = UserView;

/** Serializa as claims para o valor do cookie (base64 de JSON; sem assinatura no mock). */
export function encodeSession(user: SessionClaims): string {
  const json = JSON.stringify(user);
  // btoa nao lida com nao-ASCII (acentos nos nomes); passa por UTF-8 primeiro.
  return Buffer.from(json, "utf8").toString("base64");
}

/** Le as claims do valor do cookie; retorna null se ausente/corrompido. */
export function decodeSession(raw: string | undefined): SessionClaims | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SessionClaims>;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.profile !== "string") {
      return null;
    }
    return parsed as SessionClaims;
  } catch {
    return null;
  }
}

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
