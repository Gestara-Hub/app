import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tempo maximo da sessao do painel (doc technical/26, secao 8): 8 horas desde a
 * entrada, mesmo que o Supabase renove o token. O inicio vai num cookie
 * assinado (HMAC) preso ao usuario, para o navegador nao poder estender.
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_STARTED_COOKIE = "gestara-admin-started";

export function signSessionStart(secret: string, authUserId: string, startedAtMs: number): string {
  const payload = `${startedAtMs}.${authUserId}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export type SessionStartCheck = { ok: true; startedAtMs: number } | { ok: false; reason: "missing" | "invalid" | "expired" };

export function verifySessionStart(
  secret: string,
  authUserId: string,
  value: string | undefined,
  nowMs: number,
): SessionStartCheck {
  if (!value) return { ok: false, reason: "missing" };
  const [started, userId, signature] = value.split(".");
  if (!started || !userId || !signature || userId !== authUserId) return { ok: false, reason: "invalid" };
  const expected = createHmac("sha256", secret).update(`${started}.${userId}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  const startedAtMs = Number(started);
  if (!Number.isFinite(startedAtMs) || startedAtMs > nowMs + 60_000) return { ok: false, reason: "invalid" };
  if (nowMs - startedAtMs >= SESSION_MAX_AGE_SECONDS * 1000) return { ok: false, reason: "expired" };
  return { ok: true, startedAtMs };
}
