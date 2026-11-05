import { likeExact } from "@/lib/supabase/like";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * Troca do e-mail de acesso pela propria pessoa (migracao 87, 05/11/2026).
 * Ela pede com a senha atual; o e-mail novo recebe um link de 1 hora e a troca
 * so vale ao confirmar. O dono do espaco nao troca o e-mail de outra pessoa:
 * poderia por um e-mail dele e tomar a conta pedindo senha nova. Modulo so do
 * servidor, sem "use server": as actions em app/(auth)/email-change-actions
 * fazem a sessao, a senha, o limite de tentativas e os e-mails.
 */

export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/**
 * O e-mail ja e de acesso de outra conta (ou de um convite em aberto) em
 * qualquer espaco. A mesma pessoa em varios espacos tem varias linhas em
 * `users` com o mesmo auth_user_id: essas nao contam.
 */
export async function emailInUseByOther(
  admin: SupabaseClient,
  email: string,
  authUserId: string,
): Promise<boolean> {
  const { data } = await admin.from("users").select("auth_user_id").ilike("email", likeExact(email)).limit(20);
  return (data ?? []).some((row) => row.auth_user_id !== authUserId);
}

export type EmailChangeRequest =
  | { ok: true; token: string; newEmail: string }
  | { ok: false; code: "invalid" | "same" | "in_use" | "error" };

/** Cria o link para o e-mail novo (o pedido anterior em aberto deixa de valer). */
export async function createEmailChangeToken(
  admin: SupabaseClient,
  input: { authUserId: string; currentEmail: string; newEmail: string },
  now = new Date(),
): Promise<EmailChangeRequest> {
  const newEmail = normalizeEmail(input.newEmail);
  if (!isValidEmail(newEmail)) return { ok: false, code: "invalid" };
  if (newEmail === normalizeEmail(input.currentEmail)) return { ok: false, code: "same" };
  if (await emailInUseByOther(admin, newEmail, input.authUserId)) return { ok: false, code: "in_use" };

  await admin
    .from("email_change_tokens")
    .update({ status: "revoked" })
    .eq("auth_user_id", input.authUserId)
    .eq("status", "pending");

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("email_change_tokens").insert({
    auth_user_id: input.authUserId,
    old_email: normalizeEmail(input.currentEmail),
    new_email: newEmail,
    token_hash: hashToken(token),
    expires_at: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS).toISOString(),
  });
  if (error) {
    logError("[email-change] Erro ao criar o link:", error);
    return { ok: false, code: "error" };
  }
  return { ok: true, token, newEmail };
}

/** O e-mail com o link nao saiu: o link novo deixa de valer. */
export async function discardEmailChangeToken(admin: SupabaseClient, rawToken: string): Promise<void> {
  await admin.from("email_change_tokens").update({ status: "revoked" }).eq("token_hash", hashToken(rawToken));
}

export type EmailChangeTokenCheck =
  | { status: "valid"; authUserId: string; oldEmail: string; newEmail: string }
  | { status: "expired" | "invalid" };

/** Confere o link (`/confirm-email?token=`). */
export async function checkEmailChangeToken(
  admin: SupabaseClient,
  rawToken: string | undefined,
  now = new Date(),
): Promise<EmailChangeTokenCheck> {
  const token = rawToken?.trim();
  if (!token) return { status: "invalid" };
  const { data: row } = await admin
    .from("email_change_tokens")
    .select("auth_user_id, old_email, new_email, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!row || row.status !== "pending") return { status: row ? "expired" : "invalid" };
  if (new Date(String(row.expires_at)) <= now) return { status: "expired" };
  return {
    status: "valid",
    authUserId: String(row.auth_user_id),
    oldEmail: String(row.old_email),
    newEmail: String(row.new_email),
  };
}

export type EmailChangeResult =
  | { ok: true; oldEmail: string; newEmail: string; name: string }
  | { ok: false; code: "expired" | "invalid" | "in_use" | "error" };

/**
 * Confirma a troca (uma vez so): muda o e-mail da conta e de todas as linhas
 * da pessoa em `users` (um por espaco). Confere de novo se o e-mail ficou
 * livre, porque pode ter sido usado enquanto o link estava em aberto.
 */
export async function confirmEmailChange(
  admin: SupabaseClient,
  rawToken: string,
  now = new Date(),
): Promise<EmailChangeResult> {
  const check = await checkEmailChangeToken(admin, rawToken, now);
  if (check.status !== "valid") return { ok: false, code: check.status };
  const tokenHash = hashToken(rawToken.trim());

  if (await emailInUseByOther(admin, check.newEmail, check.authUserId)) {
    await admin.from("email_change_tokens").update({ status: "revoked" }).eq("token_hash", tokenHash);
    return { ok: false, code: "in_use" };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(check.authUserId, {
    email: check.newEmail,
    email_confirm: true,
  });
  if (authError) {
    logError("[email-change] Erro ao trocar o e-mail da conta:", authError);
    // Conta com esse e-mail no login (fora da tabela users): trata como em uso.
    return { ok: false, code: authError.status === 422 ? "in_use" : "error" };
  }

  const { data: rows, error: usersError } = await admin
    .from("users")
    .update({ email: check.newEmail })
    .eq("auth_user_id", check.authUserId)
    .select("name");
  if (usersError) {
    logError("[email-change] Erro ao trocar o e-mail nos espaços:", usersError);
    return { ok: false, code: "error" };
  }

  const nowIso = now.toISOString();
  await admin
    .from("email_change_tokens")
    .update({ status: "consumed", consumed_at: nowIso })
    .eq("token_hash", tokenHash);
  await admin
    .from("email_change_tokens")
    .update({ status: "revoked" })
    .eq("auth_user_id", check.authUserId)
    .eq("status", "pending");

  return { ok: true, oldEmail: check.oldEmail, newEmail: check.newEmail, name: String(rows?.[0]?.name ?? "") };
}
