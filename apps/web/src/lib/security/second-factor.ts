import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SESSION_MAX_AGE } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * A barreira da verificacao em duas etapas (doc technical/17, secao "Barreira").
 * O Supabase so conhece o app autenticador (AAL2). O codigo por e-mail e o
 * dispositivo lembrado sao nossos: depois deles a sessao do Supabase continua
 * AAL1, e a prova fica em `two_factor_sessions`, pelo `session_id` da sessao.
 * O cookie do app nao e assinado, entao nunca serve de prova. Modulo so do
 * servidor.
 */

export type SecondFactorState = "not_required" | "satisfied" | "missing";
export type SecondFactorMethod = "email" | "device" | "recovery";

export interface SecondFactorInfo {
  state: SecondFactorState;
  /** App autenticador confirmado. */
  app: boolean;
  /** Codigo por e-mail ligado (`app_metadata.two_factor_email`, so o servidor grava). */
  email: boolean;
}

/** `session_id` da sessao atual do Supabase (claim do access token, ja conferido pelo `getUser`). */
export async function currentSessionId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

export function emailTwoFactorEnabled(user: User): boolean {
  return user.app_metadata?.two_factor_email === true;
}

/**
 * Quem precisa do segundo fator: tem o app confirmado ou ligou o e-mail. Feito
 * nesta sessao: AAL2 (app) ou uma linha valida em `two_factor_sessions`.
 * `user` vem do `getUser()` (servidor do Supabase, `app_metadata` atual).
 */
export async function secondFactorInfo(supabase: SupabaseClient, user: User): Promise<SecondFactorInfo> {
  // Fatores do `getUser()` (atuais): o nivel guardado no token fica velho depois de remover o app.
  const app = (user.factors ?? []).some((factor) => factor.factor_type === "totp" && factor.status === "verified");
  const email = emailTwoFactorEnabled(user);
  if (!app && !email) return { state: "not_required", app: false, email: false };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") return { state: "satisfied", app, email };

  const sessionId = await currentSessionId(supabase);
  const verified = sessionId ? await isSessionVerified(createSupabaseAdminClient(), user.id, sessionId) : false;
  return { state: verified ? "satisfied" : "missing", app, email };
}

export async function secondFactorState(supabase: SupabaseClient, user: User): Promise<SecondFactorState> {
  return (await secondFactorInfo(supabase, user)).state;
}

/** Grava que esta sessao passou pelo segundo fator (codigo por e-mail ou dispositivo lembrado). */
export async function markSessionVerified(
  admin: SupabaseClient,
  authUserId: string,
  sessionId: string,
  method: SecondFactorMethod,
  now = new Date(),
): Promise<boolean> {
  const { error } = await admin.from("two_factor_sessions").upsert({
    session_id: sessionId,
    auth_user_id: authUserId,
    method,
    verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_MAX_AGE * 1000).toISOString(),
  });
  return !error;
}

export async function isSessionVerified(
  admin: SupabaseClient,
  authUserId: string,
  sessionId: string,
  now = new Date(),
): Promise<boolean> {
  const { data } = await admin
    .from("two_factor_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .eq("auth_user_id", authUserId)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  return Boolean(data);
}

/** Sair: a prova desta sessao deixa de valer (o dispositivo lembrado continua). */
export async function forgetCurrentSessionVerification(supabase: SupabaseClient): Promise<void> {
  const sessionId = await currentSessionId(supabase);
  if (!sessionId) return;
  await createSupabaseAdminClient().from("two_factor_sessions").delete().eq("session_id", sessionId);
}
