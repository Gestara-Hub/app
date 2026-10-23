"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { finishSignIn, type SignInSessionResult } from "./sign-in-session";

/**
 * Verificacao em duas etapas com aplicativo autenticador (doc 17, entrega 1),
 * pelo MFA do Supabase Auth: o codigo no login (tela /two-factor) e ligar ou
 * desligar em "Seguranca", no menu do usuario.
 */

const CODE_RE = /^\d{6}$/;
const INVALID_CODE = "Código inválido. Confira o aplicativo e tente de novo.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";

/** Fatores TOTP da sessao: o confirmado (se houver) e os que ficaram pela metade. */
async function totpFactors(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors();
  const totp = (data?.all ?? []).filter((factor) => factor.factor_type === "totp");
  return {
    verified: totp.find((factor) => factor.status === "verified") ?? null,
    pending: totp.filter((factor) => factor.status !== "verified"),
  };
}

/** Limita as tentativas de codigo por usuario: 6 a cada 5 minutos. */
async function allowCodeAttempt(authUserId: string): Promise<boolean> {
  return checkRateLimit({ key: `two_factor:${authUserId}`, maxRequests: 6, windowSeconds: 300 });
}

// ---------------------------------------------------------------------------
// Login: o codigo depois da senha (ou do Google)
// ---------------------------------------------------------------------------

/** Confere o codigo do app e so entao cria a sessao do app. */
export async function verifyTwoFactorSignInAction(input: {
  code: string;
  from?: string;
}): Promise<SignInSessionResult> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "Digite os 6 números do aplicativo." };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: SESSION_EXPIRED };
    if (!(await allowCodeAttempt(user.id))) {
      return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }

    const { verified } = await totpFactors(supabase);
    if (!verified) return { ok: false, message: SESSION_EXPIRED };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
    if (error) return { ok: false, message: INVALID_CODE };

    return await finishSignIn(createSupabaseAdminClient(), user.id, input.from);
  } catch (err) {
    console.error("[two-factor] Erro ao conferir o codigo do login:", err);
    return { ok: false, message: "Não foi possível entrar agora. Tente novamente." };
  }
}

/** "Usar outra conta": descarta a sessao que esperava o codigo. */
export async function cancelTwoFactorSignInAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Seguranca (menu do usuario): ligar e desligar o aplicativo
// ---------------------------------------------------------------------------

export type TwoFactorStatus =
  | { ok: true; googleOnly: boolean; enabled: boolean }
  | { ok: false; message: string };

/** Sessao do Supabase do mesmo usuario logado no app. */
async function sessionForCurrentUser() {
  const current = await getCurrentUser();
  if (!current) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== current.id) return null;
  return { supabase, user };
}

export async function getTwoFactorStatusAction(): Promise<TwoFactorStatus> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  const providers = (session.user.identities ?? []).map((identity) => identity.provider);
  const { verified } = await totpFactors(session.supabase);
  return {
    ok: true,
    googleOnly: providers.includes("google") && !providers.includes("email"),
    enabled: Boolean(verified),
  };
}

export type TotpEnrollment =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string };

/** Comeca o cadastro: QR code e chave para o app. */
export async function startTotpEnrollmentAction(): Promise<TotpEnrollment> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  const { supabase } = session;

  const { verified, pending } = await totpFactors(supabase);
  if (verified) return { ok: false, message: "A verificação em duas etapas já está ligada." };
  // Cadastro anterior que ficou pela metade (QR lido e codigo nunca digitado).
  for (const factor of pending) await supabase.auth.mfa.unenroll({ factorId: factor.id });

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Aplicativo ${Date.now()}`,
    issuer: "GestaraHub",
  });
  if (error || !data) {
    console.error("[two-factor] Erro ao comecar o cadastro:", error);
    return { ok: false, message: "Não foi possível começar agora. Tente novamente." };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirma o cadastro com o primeiro codigo do app: a partir dai o login pede o codigo. */
export async function confirmTotpEnrollmentAction(input: {
  factorId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "Digite os 6 números do aplicativo." };
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const { error } = await session.supabase.auth.mfa.challengeAndVerify({ factorId: input.factorId, code });
  if (error) return { ok: false, message: INVALID_CODE };
  return { ok: true };
}

/** Desliga: pede um codigo valido do app antes de remover o fator. */
export async function disableTotpAction(input: {
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "Digite os 6 números do aplicativo." };
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const { supabase } = session;
  const { verified } = await totpFactors(supabase);
  if (!verified) return { ok: true };

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
  if (verifyError) return { ok: false, message: INVALID_CODE };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
  if (error) {
    console.error("[two-factor] Erro ao desligar:", error);
    return { ok: false, message: "Não foi possível desligar agora. Tente novamente." };
  }
  return { ok: true };
}
