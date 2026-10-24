"use server";

import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { UserView } from "@gestarahub/contracts";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { sendTwoFactorCodeEmail } from "@/lib/email/mailersend";
import { isDemoOrganization } from "@/lib/demo";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { currentSessionId, markSessionVerified, secondFactorInfo } from "@/lib/security/second-factor";
import { isGoogleOnlyAccount, lastUsedLabel, maskEmail, normalizeRecoveryCode } from "@/lib/security/two-factor-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditLogInDb } from "@/services/audit/auditLogBackend";
import {
  disableTwoFactor,
  discardEmailCode,
  forgetAllTrustedDevices,
  forgetTrustedDevice,
  consumeRecoveryCode,
  issueEmailCode,
  issueRecoveryCodes,
  listTrustedDevices,
  recoveryCodesLeft,
  setEmailTwoFactor,
  verifyEmailCode,
  type EmailCodeCheck,
  type EmailCodePurpose,
} from "@/services/server/twoFactor";
import {
  clearTrustedDeviceCookie,
  finishSignIn,
  readTrustedDeviceToken,
  rememberThisDevice,
  type SignInSessionResult,
} from "./sign-in-session";
import { logError } from "@/lib/log";

/**
 * Verificacao em duas etapas (doc 17): aplicativo autenticador (MFA do Supabase,
 * entrega 1) e codigo por e-mail com "lembrar este dispositivo" (entrega 2). O
 * codigo no login (tela /two-factor) e ligar ou desligar em "Seguranca", no
 * menu do usuario.
 */

const CODE_RE = /^\d{6}$/;
const INVALID_APP_CODE = "Código inválido. Confira o aplicativo e tente de novo.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";
const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

type ActionResult = { ok: true } | { ok: false; message: string };
/** Ligar a verificacao devolve os codigos de recuperacao (so desta vez) quando a pessoa ainda nao tinha. */
export type EnableResult = { ok: true; recoveryCodes?: string[] } | { ok: false; message: string };
const INVALID_RECOVERY_CODE = "Código de recuperação inválido ou já usado.";

/** Gera os codigos de recuperacao se a pessoa ainda nao tem nenhum valendo (primeira vez que liga). */
async function ensureRecoveryCodes(admin: SupabaseClient, authUserId: string): Promise<string[] | undefined> {
  if ((await recoveryCodesLeft(admin, authUserId)) > 0) return undefined;
  return (await issueRecoveryCodes(admin, authUserId)) ?? undefined;
}

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

function emailCodeMessage(check: Exclude<EmailCodeCheck, "ok">): string {
  if (check === "locked") return "Muitas tentativas com este código. Peça um código novo.";
  if (check === "expired") return "Este código venceu. Peça um código novo.";
  return "Código inválido. Confira o e-mail e tente de novo.";
}

export type SendEmailCodeResult =
  | { ok: true; maskedEmail: string; resendInSeconds: number }
  | { ok: false; message: string; resendInSeconds?: number };

/** Cria o codigo e manda para o e-mail da conta. */
async function sendEmailCode(user: User, name: string, purpose: EmailCodePurpose): Promise<SendEmailCodeResult> {
  const email = user.email ?? "";
  if (!email) return { ok: false, message: "Sua conta não tem e-mail." };
  const admin = createSupabaseAdminClient();
  const issued = await issueEmailCode(admin, user.id, purpose);
  if (!issued.ok) {
    if (issued.reason === "wait") {
      return {
        ok: false,
        message: `Enviamos um código há pouco. Aguarde ${issued.resendInSeconds} s para pedir outro.`,
        resendInSeconds: issued.resendInSeconds,
      };
    }
    if (issued.reason === "limit") return { ok: false, message: "Muitos envios. Aguarde 15 minutos e tente de novo." };
    return { ok: false, message: "Não foi possível enviar o código. Tente novamente." };
  }
  const sent = await sendTwoFactorCodeEmail({ toEmail: email, toName: name || email, code: issued.code });
  if (!sent.ok) {
    await discardEmailCode(admin, user.id, purpose);
    return { ok: false, message: sent.error };
  }
  return { ok: true, maskedEmail: maskEmail(email), resendInSeconds: issued.resendInSeconds };
}

async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

/** Evento de seguranca na auditoria (so o dono ve, como os de usuario dono). */
async function auditSecurity(current: UserView, predicate: string): Promise<void> {
  await recordAuditLogInDb({
    action: "updated",
    target: { type: "user", id: current.id, label: current.name, profile: current.profile },
    predicate,
    security: true,
  });
}

// ---------------------------------------------------------------------------
// Login: o codigo depois da senha (ou do Google)
// ---------------------------------------------------------------------------

/** Sessao do Supabase esperando o segundo fator (tela /two-factor). */
async function pendingSignIn() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const info = await secondFactorInfo(supabase, user);
  if (info.state !== "missing") return null;
  return { supabase, user, info };
}

/** Manda o codigo do login por e-mail (ao abrir a tela e no "Reenviar codigo"). */
export async function sendSignInEmailCodeAction(): Promise<SendEmailCodeResult> {
  try {
    const pending = await pendingSignIn();
    if (!pending || !pending.info.email) return { ok: false, message: SESSION_EXPIRED };
    const name = String(pending.user.user_metadata?.full_name ?? pending.user.user_metadata?.name ?? "");
    return await sendEmailCode(pending.user, name, "login");
  } catch (err) {
    logError("[two-factor] Erro ao enviar o codigo do login:", err);
    return { ok: false, message: "Não foi possível enviar o código. Tente novamente." };
  }
}

/** Confere o codigo (app ou e-mail) e so entao cria a sessao do app. */
export async function verifyTwoFactorSignInAction(input: {
  code: string;
  method: "app" | "email" | "recovery";
  remember?: boolean;
  from?: string;
}): Promise<SignInSessionResult> {
  const code = input.code.replace(/\s/g, "");
  if (input.method === "recovery") {
    if (!normalizeRecoveryCode(code)) return { ok: false, message: "Digite o código de recuperação (8 letras e números)." };
  } else if (!CODE_RE.test(code)) {
    return { ok: false, message: input.method === "app" ? "Digite os 6 números do aplicativo." : "Digite os 6 números do e-mail." };
  }

  try {
    const pending = await pendingSignIn();
    if (!pending) return { ok: false, message: SESSION_EXPIRED };
    const { supabase, user, info } = pending;
    if (!(await allowCodeAttempt(user.id))) return { ok: false, message: TOO_MANY };
    const admin = createSupabaseAdminClient();

    if (input.method === "app") {
      const { verified } = await totpFactors(supabase);
      if (!info.app || !verified) return { ok: false, message: SESSION_EXPIRED };
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
      if (error) return { ok: false, message: INVALID_APP_CODE };
    } else if (input.method === "recovery") {
      if (!(await consumeRecoveryCode(admin, user.id, code))) return { ok: false, message: INVALID_RECOVERY_CODE };
      const sessionId = await currentSessionId(supabase);
      if (!sessionId || !(await markSessionVerified(admin, user.id, sessionId, "recovery"))) {
        return { ok: false, message: "Não foi possível entrar agora. Tente novamente." };
      }
    } else {
      if (!info.email) return { ok: false, message: SESSION_EXPIRED };
      const check = await verifyEmailCode(admin, user.id, "login", code);
      if (check !== "ok") return { ok: false, message: emailCodeMessage(check) };
      const sessionId = await currentSessionId(supabase);
      if (!sessionId || !(await markSessionVerified(admin, user.id, sessionId, "email"))) {
        return { ok: false, message: "Não foi possível entrar agora. Tente novamente." };
      }
    }

    if (input.remember) await rememberThisDevice(user.id, await userAgent());
    return await finishSignIn(admin, user.id, input.from);
  } catch (err) {
    logError("[two-factor] Erro ao conferir o codigo do login:", err);
    return { ok: false, message: "Não foi possível entrar agora. Tente novamente." };
  }
}

/** "Usar outra conta": descarta a sessao que esperava o codigo. */
export async function cancelTwoFactorSignInAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Seguranca (menu do usuario): ligar e desligar
// ---------------------------------------------------------------------------

export type TwoFactorStatus =
  | {
      ok: true;
      googleOnly: boolean;
      /** Espaco de demonstracao: a verificacao fica desligada (todos entram com a mesma conta). */
      demo: boolean;
      /** App ou e-mail ligado. */
      enabled: boolean;
      app: boolean;
      email: boolean;
      maskedEmail: string;
      /** Codigos de recuperacao que ainda valem. */
      recoveryLeft: number;
    }
  | { ok: false; message: string };

/** Sessao do Supabase do mesmo usuario logado no app. */
async function sessionForCurrentUser() {
  const current = await getCurrentUser();
  if (!current) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Convidado tem id proprio no app, ligado a conta pelo auth_user_id.
  if (user.id !== current.id) {
    const { data: row } = await createSupabaseAdminClient()
      .from("users")
      .select("id")
      .eq("id", current.id)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!row) return null;
  }
  return { supabase, user, current };
}

/** Sessao para mudar a verificacao: fora da demonstracao e de conta so do Google. */
async function sessionToChange() {
  const session = await sessionForCurrentUser();
  if (!session || isDemoOrganization(session.current.organizationId)) return null;
  return session;
}

function isGoogleOnly(user: User): boolean {
  return isGoogleOnlyAccount((user.identities ?? []).map((identity) => identity.provider));
}

export async function getTwoFactorStatusAction(): Promise<TwoFactorStatus> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  const info = await secondFactorInfo(session.supabase, session.user);
  return {
    ok: true,
    googleOnly: isGoogleOnly(session.user),
    demo: isDemoOrganization(session.current.organizationId),
    enabled: info.app || info.email,
    app: info.app,
    email: info.email,
    maskedEmail: maskEmail(session.user.email ?? ""),
    recoveryLeft: info.app || info.email ? await recoveryCodesLeft(createSupabaseAdminClient(), session.user.id) : 0,
  };
}

export type TotpEnrollment =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string };

/** Comeca o cadastro do app: QR code e chave. */
export async function startTotpEnrollmentAction(): Promise<TotpEnrollment> {
  const session = await sessionToChange();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  const { supabase } = session;

  const { verified, pending } = await totpFactors(supabase);
  if (verified) return { ok: false, message: "O aplicativo já está ligado." };
  // Cadastro anterior que ficou pela metade (QR lido e codigo nunca digitado).
  for (const factor of pending) await supabase.auth.mfa.unenroll({ factorId: factor.id });

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Aplicativo ${Date.now()}`,
    issuer: "GestaraHub",
  });
  if (error || !data) {
    logError("[two-factor] Erro ao comecar o cadastro:", error);
    return { ok: false, message: "Não foi possível começar agora. Tente novamente." };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirma o cadastro com o primeiro codigo do app: a partir dai o login pede o codigo. */
export async function confirmTotpEnrollmentAction(input: { factorId: string; code: string }): Promise<EnableResult> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "Digite os 6 números do aplicativo." };
  const session = await sessionToChange();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) return { ok: false, message: TOO_MANY };

  const { error } = await session.supabase.auth.mfa.challengeAndVerify({ factorId: input.factorId, code });
  if (error) return { ok: false, message: INVALID_APP_CODE };
  await auditSecurity(session.current, "ligou a verificação em duas etapas com aplicativo");
  return { ok: true, recoveryCodes: await ensureRecoveryCodes(createSupabaseAdminClient(), session.user.id) };
}

/** Manda o codigo para ligar ou desligar pelo e-mail. */
export async function sendSecurityEmailCodeAction(input: { purpose: "enable" | "disable" | "recovery" }): Promise<SendEmailCodeResult> {
  try {
    const session = await sessionToChange();
    if (!session || isGoogleOnly(session.user)) return { ok: false, message: SESSION_EXPIRED };
    return await sendEmailCode(session.user, session.current.name, input.purpose);
  } catch (err) {
    logError("[two-factor] Erro ao enviar o codigo de seguranca:", err);
    return { ok: false, message: "Não foi possível enviar o código. Tente novamente." };
  }
}

/** Liga o codigo por e-mail com o codigo recebido. Esta sessao ja conta como verificada. */
export async function enableEmailTwoFactorAction(input: { code: string }): Promise<EnableResult> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "Digite os 6 números do e-mail." };
  const session = await sessionToChange();
  if (!session || isGoogleOnly(session.user)) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) return { ok: false, message: TOO_MANY };

  const admin = createSupabaseAdminClient();
  const check = await verifyEmailCode(admin, session.user.id, "enable", code);
  if (check !== "ok") return { ok: false, message: emailCodeMessage(check) };

  // Antes de ligar: sem a prova desta sessao, a barreira trancaria quem acabou de ligar.
  const sessionId = await currentSessionId(session.supabase);
  if (!sessionId || !(await markSessionVerified(admin, session.user.id, sessionId, "email"))) {
    return { ok: false, message: "Não foi possível ligar agora. Tente novamente." };
  }
  if (!(await setEmailTwoFactor(admin, session.user.id, true))) {
    return { ok: false, message: "Não foi possível ligar agora. Tente novamente." };
  }
  await auditSecurity(session.current, "ligou a verificação em duas etapas por e-mail");
  return { ok: true, recoveryCodes: await ensureRecoveryCodes(admin, session.user.id) };
}

/**
 * Desliga tudo com um codigo (do app ou do e-mail, o que estiver ligado):
 * remove o app, o e-mail, os dispositivos lembrados e as sessoes verificadas.
 */
export async function disableTwoFactorAction(input: { code: string; method: "app" | "email" | "recovery" }): Promise<ActionResult> {
  const code = input.code.replace(/\s/g, "");
  if (input.method === "recovery") {
    if (!normalizeRecoveryCode(code)) return { ok: false, message: "Digite o código de recuperação (8 letras e números)." };
  } else if (!CODE_RE.test(code)) {
    return { ok: false, message: input.method === "app" ? "Digite os 6 números do aplicativo." : "Digite os 6 números do e-mail." };
  }
  const session = await sessionToChange();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) return { ok: false, message: TOO_MANY };

  const { supabase, user } = session;
  const admin = createSupabaseAdminClient();
  const info = await secondFactorInfo(supabase, user);
  if (!info.app && !info.email) return { ok: true };

  if (input.method === "app") {
    const { verified } = await totpFactors(supabase);
    if (!verified) return { ok: false, message: INVALID_APP_CODE };
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
    if (error) return { ok: false, message: INVALID_APP_CODE };
  } else if (input.method === "recovery") {
    // Quem perdeu o aplicativo desliga com um codigo de recuperacao e liga de novo com o aparelho novo.
    if (!(await consumeRecoveryCode(admin, user.id, code))) return { ok: false, message: INVALID_RECOVERY_CODE };
  } else {
    if (!info.email) return { ok: false, message: "O código por e-mail não está ligado." };
    const check = await verifyEmailCode(admin, user.id, "disable", code);
    if (check !== "ok") return { ok: false, message: emailCodeMessage(check) };
  }

  if (!(await disableTwoFactor(admin, user.id))) {
    return { ok: false, message: "Não foi possível desligar agora. Tente novamente." };
  }
  await clearTrustedDeviceCookie();
  await auditSecurity(session.current, "desligou a verificação em duas etapas");
  return { ok: true };
}

/**
 * Gera 8 codigos de recuperacao novos (os antigos deixam de valer) com um
 * codigo do app ou do e-mail. Devolve os codigos so desta vez.
 */
export async function regenerateRecoveryCodesAction(input: {
  code: string;
  method: "app" | "email";
}): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; message: string }> {
  const code = input.code.replace(/\s/g, "");
  if (!CODE_RE.test(code)) {
    return { ok: false, message: input.method === "app" ? "Digite os 6 números do aplicativo." : "Digite os 6 números do e-mail." };
  }
  const session = await sessionToChange();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  if (!(await allowCodeAttempt(session.user.id))) return { ok: false, message: TOO_MANY };

  const { supabase, user } = session;
  const admin = createSupabaseAdminClient();
  const info = await secondFactorInfo(supabase, user);
  if (!info.app && !info.email) return { ok: false, message: "Ligue a verificação em duas etapas primeiro." };

  if (input.method === "app") {
    const { verified } = await totpFactors(supabase);
    if (!verified) return { ok: false, message: INVALID_APP_CODE };
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
    if (error) return { ok: false, message: INVALID_APP_CODE };
  } else {
    if (!info.email) return { ok: false, message: "O código por e-mail não está ligado." };
    const check = await verifyEmailCode(admin, user.id, "recovery", code);
    if (check !== "ok") return { ok: false, message: emailCodeMessage(check) };
  }

  const recoveryCodes = await issueRecoveryCodes(admin, user.id);
  if (!recoveryCodes) return { ok: false, message: "Não foi possível gerar agora. Tente novamente." };
  await auditSecurity(session.current, "gerou novos códigos de recuperação da verificação em duas etapas");
  return { ok: true, recoveryCodes };
}

// ---------------------------------------------------------------------------
// Dispositivos lembrados
// ---------------------------------------------------------------------------

export type TrustedDeviceItem = { id: string; label: string; lastUsed: string; current: boolean };

export async function listTrustedDevicesAction(): Promise<
  { ok: true; devices: TrustedDeviceItem[] } | { ok: false; message: string }
> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  const now = new Date();
  const devices = await listTrustedDevices(
    createSupabaseAdminClient(),
    session.user.id,
    await readTrustedDeviceToken(),
    now,
  );
  return {
    ok: true,
    devices: devices.map((device) => ({
      id: device.id,
      label: device.label,
      lastUsed: lastUsedLabel(new Date(device.lastUsedAt), now),
      current: device.current,
    })),
  };
}

/** "Esquecer": o proximo login nesse navegador volta a pedir o codigo. */
export async function forgetTrustedDeviceAction(input: { id: string; current: boolean }): Promise<ActionResult> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  await forgetTrustedDevice(createSupabaseAdminClient(), session.user.id, input.id);
  if (input.current) await clearTrustedDeviceCookie();
  return { ok: true };
}

export async function forgetAllTrustedDevicesAction(): Promise<ActionResult> {
  const session = await sessionForCurrentUser();
  if (!session) return { ok: false, message: SESSION_EXPIRED };
  await forgetAllTrustedDevices(createSupabaseAdminClient(), session.user.id);
  await clearTrustedDeviceCookie();
  return { ok: true };
}
