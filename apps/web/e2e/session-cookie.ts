import { createHash, createHmac } from "node:crypto";

/**
 * Cookie de sessao do app assinado como o servidor (`src/lib/session-cookie.ts`):
 * desde 30/10/2026 cookie sem assinatura vira "sem sessao". O segredo vem do
 * mesmo `.env.local` do servidor dos testes.
 */
export function sessionCookieValue(claims: Record<string, unknown>): string {
  const explicit = process.env.SESSION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = explicit
    ? Buffer.from(explicit, "utf8")
    : createHash("sha256").update(`gestarahub-session-cookie:${serviceKey ?? "desenvolvimento"}`).digest();
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
