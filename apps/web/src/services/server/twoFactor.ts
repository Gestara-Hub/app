import { randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_SEND_LIMIT,
  EMAIL_CODE_SEND_WINDOW_SECONDS,
  EMAIL_CODE_TTL_MS,
  TRUSTED_DEVICE_TTL_MS,
  afterWrongCode,
  deviceLabel,
  generateEmailCode,
  hashDeviceToken,
  hashEmailCode,
  isExpired,
  resendWaitSeconds,
} from "@/lib/security/two-factor-rules";
import { logError } from "@/lib/log";

/**
 * Verificacao em duas etapas, entrega 2 (doc technical/17): codigo por e-mail,
 * dispositivos lembrados e ligar/desligar. Modulo so do servidor, sem
 * "use server": as actions em app/(auth)/two-factor-actions conferem a sessao
 * e mandam o e-mail. Tudo pela chave de servico (tabelas sem politicas, migracao 48).
 */

export type EmailCodePurpose = "login" | "enable" | "disable";

export type IssueEmailCodeResult =
  | { ok: true; code: string; resendInSeconds: number }
  | { ok: false; reason: "wait"; resendInSeconds: number }
  | { ok: false; reason: "limit" | "error" };

/**
 * Cria um codigo novo (os anteriores do mesmo proposito deixam de valer).
 * Respeita a espera entre envios e o limite por usuario.
 */
export async function issueEmailCode(
  admin: SupabaseClient,
  authUserId: string,
  purpose: EmailCodePurpose,
  now = new Date(),
): Promise<IssueEmailCodeResult> {
  const { data: last } = await admin
    .from("two_factor_email_codes")
    .select("created_at")
    .eq("auth_user_id", authUserId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const wait = resendWaitSeconds(last ? new Date(String(last.created_at)) : null, now);
  if (wait > 0) return { ok: false, reason: "wait", resendInSeconds: wait };

  const allowed = await checkRateLimit({
    key: `two_factor_email:${authUserId}`,
    maxRequests: EMAIL_CODE_SEND_LIMIT,
    windowSeconds: EMAIL_CODE_SEND_WINDOW_SECONDS,
  });
  if (!allowed) return { ok: false, reason: "limit" };

  await admin
    .from("two_factor_email_codes")
    .update({ status: "revoked" })
    .eq("auth_user_id", authUserId)
    .eq("purpose", purpose)
    .eq("status", "pending");

  const code = generateEmailCode();
  const { error } = await admin.from("two_factor_email_codes").insert({
    auth_user_id: authUserId,
    purpose,
    code_hash: hashEmailCode(authUserId, code),
    expires_at: new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString(),
    created_at: now.toISOString(),
  });
  if (error) {
    logError("[two-factor] Erro ao criar o codigo por e-mail:", error);
    return { ok: false, reason: "error" };
  }
  return { ok: true, code, resendInSeconds: EMAIL_CODE_RESEND_SECONDS };
}

/** O e-mail nao saiu: o codigo novo deixa de valer e libera o reenvio. */
export async function discardEmailCode(admin: SupabaseClient, authUserId: string, purpose: EmailCodePurpose): Promise<void> {
  await admin
    .from("two_factor_email_codes")
    .delete()
    .eq("auth_user_id", authUserId)
    .eq("purpose", purpose)
    .eq("status", "pending");
}

export type EmailCodeCheck = "ok" | "invalid" | "locked" | "expired";

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Confere o codigo em aberto mais recente. Certo: vale uma vez so. */
export async function verifyEmailCode(
  admin: SupabaseClient,
  authUserId: string,
  purpose: EmailCodePurpose,
  code: string,
  now = new Date(),
): Promise<EmailCodeCheck> {
  const { data: row } = await admin
    .from("two_factor_email_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("auth_user_id", authUserId)
    .eq("purpose", purpose)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || isExpired(new Date(String(row.expires_at)), now)) return "expired";

  if (!sameHash(String(row.code_hash), hashEmailCode(authUserId, code))) {
    const next = afterWrongCode(Number(row.attempts ?? 0));
    await admin
      .from("two_factor_email_codes")
      .update({ attempts: next.attempts, ...(next.locked ? { status: "revoked" } : {}) })
      .eq("id", row.id)
      .eq("status", "pending");
    return next.locked ? "locked" : "invalid";
  }

  // So um pedido usa o codigo, mesmo com dois cliques ao mesmo tempo.
  const { data: used } = await admin
    .from("two_factor_email_codes")
    .update({ status: "consumed", consumed_at: now.toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  return used && used.length > 0 ? "ok" : "expired";
}

// ---------------------------------------------------------------------------
// Ligar e desligar
// ---------------------------------------------------------------------------

/** Liga ou desliga o codigo por e-mail no `app_metadata` (o usuario nao consegue mudar). */
export async function setEmailTwoFactor(admin: SupabaseClient, authUserId: string, enabled: boolean): Promise<boolean> {
  const { error } = await admin.auth.admin.updateUserById(authUserId, { app_metadata: { two_factor_email: enabled } });
  if (error) logError("[two-factor] Erro ao gravar o codigo por e-mail na conta:", error);
  return !error;
}

/**
 * Desliga tudo: o app (se houver), o e-mail, os dispositivos lembrados e as
 * sessoes ja verificadas. O codigo ja foi conferido por quem chama.
 */
export async function disableTwoFactor(admin: SupabaseClient, authUserId: string, now = new Date()): Promise<boolean> {
  const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: authUserId });
  if (listError) {
    logError("[two-factor] Erro ao listar os fatores para desligar:", listError);
    return false;
  }
  for (const factor of factors?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: authUserId });
    if (error) {
      logError("[two-factor] Erro ao remover o aplicativo:", error);
      return false;
    }
  }
  if (!(await setEmailTwoFactor(admin, authUserId, false))) return false;
  await forgetAllTrustedDevices(admin, authUserId, now);
  await admin.from("two_factor_sessions").delete().eq("auth_user_id", authUserId);
  return true;
}

// ---------------------------------------------------------------------------
// Dispositivos lembrados
// ---------------------------------------------------------------------------

/** Lembra este navegador por 30 dias: devolve o token do cookie (no banco, so o hash). */
export async function rememberDevice(
  admin: SupabaseClient,
  authUserId: string,
  userAgent: string | null,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date } | null> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  const { error } = await admin.from("trusted_devices").insert({
    auth_user_id: authUserId,
    token_hash: hashDeviceToken(token),
    label: deviceLabel(userAgent),
    created_at: now.toISOString(),
    last_used_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    logError("[two-factor] Erro ao lembrar o dispositivo:", error);
    return null;
  }
  return { token, expiresAt };
}

/** Dispositivo lembrado valido para esse usuario? Se sim, conta o uso. */
export async function consumeTrustedDevice(
  admin: SupabaseClient,
  authUserId: string,
  token: string | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!token) return false;
  const { data: row } = await admin
    .from("trusted_devices")
    .select("id")
    .eq("token_hash", hashDeviceToken(token))
    .eq("auth_user_id", authUserId)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (!row) return false;
  await admin.from("trusted_devices").update({ last_used_at: now.toISOString() }).eq("id", row.id);
  return true;
}

export interface TrustedDeviceView {
  id: string;
  label: string;
  lastUsedAt: string;
  /** Este navegador (o cookie bate). */
  current: boolean;
}

export async function listTrustedDevices(
  admin: SupabaseClient,
  authUserId: string,
  currentToken: string | undefined,
  now = new Date(),
): Promise<TrustedDeviceView[]> {
  const { data } = await admin
    .from("trusted_devices")
    .select("id, label, last_used_at, token_hash")
    .eq("auth_user_id", authUserId)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .order("last_used_at", { ascending: false });
  const currentHash = currentToken ? hashDeviceToken(currentToken) : null;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label || "Navegador"),
    lastUsedAt: String(row.last_used_at),
    current: row.token_hash === currentHash,
  }));
}

export async function forgetTrustedDevice(
  admin: SupabaseClient,
  authUserId: string,
  deviceId: string,
  now = new Date(),
): Promise<void> {
  await admin
    .from("trusted_devices")
    .update({ revoked_at: now.toISOString() })
    .eq("id", deviceId)
    .eq("auth_user_id", authUserId)
    .is("revoked_at", null);
}

export async function forgetAllTrustedDevices(admin: SupabaseClient, authUserId: string, now = new Date()): Promise<void> {
  await admin
    .from("trusted_devices")
    .update({ revoked_at: now.toISOString() })
    .eq("auth_user_id", authUserId)
    .is("revoked_at", null);
}
