import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_MAX_AGE, type SessionClaims } from "./session";

/**
 * Cookie de sessao do app, assinado (HMAC-SHA256). So do servidor (usa
 * `node:crypto`; `lib/session` tambem vai para o navegador). Antes o cookie era
 * base64 de JSON sem assinatura: qualquer um montava um com outro perfil ou
 * outro espaco, e as actions que liam so o cookie acreditavam (auditoria de
 * 30/10/2026). Formato: `<claims em base64>.<assinatura em base64url>`.
 *
 * Segredo: `SESSION_SECRET`; sem ele, derivado da chave de servico do Supabase
 * (existe em todo ambiente com banco e nunca vai ao navegador). Trocar o
 * segredo encerra as sessoes abertas. Sem nenhum dos dois (desenvolvimento so
 * com a demonstracao), um segredo fixo de desenvolvimento; em producao, erro.
 */
function secret(): Buffer {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return Buffer.from(explicit, "utf8");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return createHash("sha256").update(`gestarahub-session-cookie:${serviceKey}`).digest();
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) ausente: sem como assinar a sessão.");
  }
  return createHash("sha256").update("gestarahub-session-cookie:desenvolvimento").digest();
}

function sign(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

/** Valor do cookie: as claims em base64 e a assinatura. */
export function encodeSession(user: SessionClaims): string {
  // btoa nao lida com nao-ASCII (acentos nos nomes); passa por UTF-8 primeiro.
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

/** Claims do cookie; `null` se ausente, corrompido, sem assinatura ou com assinatura que nao confere. */
export function decodeSession(raw: string | undefined): SessionClaims | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1), "base64url");
  const expected = sign(payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as Partial<SessionClaims>;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.profile !== "string") return null;
    return parsed as SessionClaims;
  } catch {
    return null;
  }
}

/** Opcoes do cookie: fora do alcance do JavaScript da pagina e so por HTTPS em producao. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}
