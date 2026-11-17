import type { SupabaseClient } from "@supabase/supabase-js";

/** Claims lidos do token de acesso local (nao confere assinatura nem chama o Auth; validar acesso com `getUser`). */
export interface SessionTokenClaims {
  sub?: unknown;
  session_id?: unknown;
  app_metadata?: { providers?: unknown };
}

/** Decodifica o payload JWT de `access_token` sem tocar em `session.user`. */
export function decodeJwtPayload(token: string | undefined): SessionTokenClaims | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as SessionTokenClaims) : null;
  } catch {
    return null;
  }
}

/**
 * Le os claims do `access_token` da sessao local do Supabase sem acessar
 * `session.user` (que dispara o aviso de seguranca do `@supabase/auth-js` no
 * servidor). Decisoes de autenticacao/permissao continuam exigindo `getUser()`.
 */
export async function readSessionClaims(
  supabase: { auth: Pick<SupabaseClient["auth"], "getSession"> },
): Promise<SessionTokenClaims | null> {
  const { data } = await supabase.auth.getSession();
  return decodeJwtPayload(data.session?.access_token);
}
