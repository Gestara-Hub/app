import { likeExact } from "@/lib/supabase/like";
import { createHash, randomBytes } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * "Esqueci minha senha" (migracao 36): link de 1 hora para quem tem senha. Quem
 * entra so pelo Google nao recebe (entra direto pelo Google). Modulo so do
 * servidor, sem "use server": as actions em app/(auth)/password-reset-actions
 * fazem o limite de tentativas e o e-mail.
 */

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export { MIN_PASSWORD_LENGTH };

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Usuario ativo do app com esse e-mail e senha no Supabase Auth (nao so Google). */
async function accountWithPassword(
  admin: SupabaseClient,
  email: string,
): Promise<{ authUserId: string; name: string } | null> {
  const { data: users } = await admin
    .from("users")
    .select("auth_user_id, name, status")
    .ilike("email", likeExact(email))
    .eq("status", "active")
    .not("auth_user_id", "is", null)
    .limit(1);
  const user = users?.[0];
  if (!user?.auth_user_id) return null;
  const { data } = await admin.auth.admin.getUserById(String(user.auth_user_id));
  const providers = (data?.user?.identities ?? []).map((identity) => identity.provider);
  if (!providers.includes("email")) return null;
  return { authUserId: String(user.auth_user_id), name: String(user.name ?? "") };
}

/**
 * Cria o link para o e-mail (o anterior em aberto deixa de valer). Sem conta
 * com senha, devolve null: a tela responde igual nos dois casos, para nao
 * revelar quais e-mails tem conta.
 */
export async function createPasswordResetToken(
  admin: SupabaseClient,
  rawEmail: string,
  now = new Date(),
): Promise<{ token: string; email: string; name: string } | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;
  const account = await accountWithPassword(admin, email);
  if (!account) return null;

  await admin
    .from("password_reset_tokens")
    .update({ status: "revoked" })
    .eq("auth_user_id", account.authUserId)
    .eq("status", "pending");

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("password_reset_tokens").insert({
    auth_user_id: account.authUserId,
    email,
    token_hash: hashToken(token),
    expires_at: new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString(),
  });
  if (error) {
    logError("[password-reset] Erro ao criar o link:", error);
    return null;
  }
  return { token, email, name: account.name };
}

/** O e-mail com o link nao saiu: o link novo deixa de valer. */
export async function discardPasswordResetToken(admin: SupabaseClient, rawToken: string): Promise<void> {
  await admin.from("password_reset_tokens").update({ status: "revoked" }).eq("token_hash", hashToken(rawToken));
}

export type PasswordResetTokenCheck =
  | { status: "valid"; authUserId: string; email: string }
  | { status: "expired" | "invalid" };

/** Confere o link (`/reset-password?token=`). */
export async function checkPasswordResetToken(
  admin: SupabaseClient,
  rawToken: string | undefined,
  now = new Date(),
): Promise<PasswordResetTokenCheck> {
  const token = rawToken?.trim();
  if (!token) return { status: "invalid" };
  const { data: row } = await admin
    .from("password_reset_tokens")
    .select("id, auth_user_id, email, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!row || row.status !== "pending") return { status: row ? "expired" : "invalid" };
  if (new Date(String(row.expires_at)) <= now) return { status: "expired" };
  return { status: "valid", authUserId: String(row.auth_user_id), email: String(row.email) };
}

export type PasswordResetResult =
  | { ok: true; email: string }
  | { ok: false; code: "expired" | "invalid" | "weak" | "error" };

/** Troca a senha e usa o link (uma vez so). */
export async function resetPasswordWithToken(
  admin: SupabaseClient,
  rawToken: string,
  password: string,
  now = new Date(),
): Promise<PasswordResetResult> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: "weak" };
  const check = await checkPasswordResetToken(admin, rawToken, now);
  if (check.status !== "valid") return { ok: false, code: check.status };

  const { error } = await admin.auth.admin.updateUserById(check.authUserId, { password });
  if (error) {
    logError("[password-reset] Erro ao trocar a senha:", error);
    return { ok: false, code: "error" };
  }
  const nowIso = now.toISOString();
  await admin
    .from("password_reset_tokens")
    .update({ status: "consumed", consumed_at: nowIso })
    .eq("token_hash", hashToken(rawToken.trim()));
  await admin
    .from("password_reset_tokens")
    .update({ status: "revoked" })
    .eq("auth_user_id", check.authUserId)
    .eq("status", "pending");
  return { ok: true, email: check.email };
}
