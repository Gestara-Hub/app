"use server";

import { afterResponse } from "@/lib/after-response";
import { headers } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { isDemoOrganization } from "@/lib/demo";
import { sendEmailChangeConfirmEmail, sendEmailChangedNoticeEmail, sendTwoFactorCodeEmail } from "@/lib/email/ses";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { logError, withErrorScope } from "@/lib/log";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { secondFactorState } from "@/lib/security/second-factor";
import { isGoogleOnlyAccount, maskEmail } from "@/lib/security/two-factor-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditLogInDb } from "@/services/audit/auditLogBackend";
import {
  confirmEmailChange,
  createEmailChangeToken,
  discardEmailChangeToken,
  isValidEmail,
  normalizeEmail,
} from "@/services/server/emailChange";
import { discardEmailCode, issueEmailCode, verifyEmailCode } from "@/services/server/twoFactor";

/**
 * Troca do e-mail de acesso pela propria pessoa (05/11/2026, doc technical/17
 * §"Troca do e-mail de acesso"): pede com a senha atual (e o segundo fator, se
 * ligado), o e-mail novo confirma pelo link e o antigo recebe um aviso.
 */

const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";
const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3200";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sessao do Supabase do mesmo usuario logado no app. */
async function sessionForCurrentUser() {
  const current = await getCurrentUser();
  if (!current) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
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

/** Senha conferida num cliente a parte, sem mexer na sessao do navegador. */
async function passwordMatches(email: string, password: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  // Encerra so a sessao criada aqui (o padrao "global" derrubaria a do navegador).
  if (data.session) {
    await createSupabaseAdminClient().auth.admin.signOut(data.session.access_token, "local");
  }
  return !error;
}

function isGoogleOnlyUser(user: User): boolean {
  return isGoogleOnlyAccount((user.identities ?? []).map((identity) => identity.provider));
}

/**
 * Como a pessoa prova que e ela: a senha atual ou, para quem entra so pelo
 * Google (sem senha), um codigo no e-mail atual.
 */
export type AccessEmailStatus =
  | { ok: true; email: string; canChange: true; proof: "password" | "code" }
  | { ok: true; email: string; canChange: false }
  | { ok: false; message: string };

export async function getAccessEmailStatusAction(): Promise<AccessEmailStatus> {
  return withErrorScope(async () => {
    const session = await sessionForCurrentUser();
    if (!session) return { ok: false, message: SESSION_EXPIRED };
    const email = session.user.email ?? "";
    if (isDemoOrganization(session.current.organizationId)) return { ok: true, email, canChange: false };
    return { ok: true, email, canChange: true, proof: isGoogleOnlyUser(session.user) ? "code" : "password" };
  });
}

export type SendAccessEmailCodeResult =
  | { ok: true; maskedEmail: string; resendInSeconds: number }
  | { ok: false; message: string; resendInSeconds?: number };

/** Quem entra pelo Google: codigo de 6 numeros no e-mail atual (vale 10 minutos). */
export async function sendAccessEmailCodeAction(): Promise<SendAccessEmailCodeResult> {
  return withErrorScope(async () => {
    const session = await sessionForCurrentUser();
    if (!session || isDemoOrganization(session.current.organizationId)) return { ok: false, message: SESSION_EXPIRED };
    const { user, current } = session;
    if (!isGoogleOnlyUser(user)) return { ok: false, message: "Confirme com a sua senha." };
    const email = user.email ?? "";
    try {
      const admin = createSupabaseAdminClient();
      const issued = await issueEmailCode(admin, user.id, "email_change");
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
      const sent = await sendTwoFactorCodeEmail({ toEmail: email, toName: current.name || email, code: issued.code });
      if (!sent.ok) {
        await discardEmailCode(admin, user.id, "email_change");
        return { ok: false, message: sent.error };
      }
      return { ok: true, maskedEmail: maskEmail(email), resendInSeconds: issued.resendInSeconds };
    } catch (err) {
      logError("[email-change] Erro ao enviar o código:", err);
      return { ok: false, message: "Não foi possível enviar o código. Tente novamente." };
    }
  });
}

export type RequestEmailChangeResult =
  | { ok: true; newEmail: string }
  | { ok: false; message: string; field?: "newEmail" | "password" | "code" };

/** Pede a troca: confere a senha (ou o codigo, no Google) e manda o link para o e-mail novo. */
export async function requestAccessEmailChangeAction(input: {
  newEmail: string;
  password?: string;
  code?: string;
}): Promise<RequestEmailChangeResult> {
  return withErrorScope(async () => {
    const session = await sessionForCurrentUser();
    if (!session) return { ok: false, message: SESSION_EXPIRED };
    const { user, current, supabase } = session;
    if (isDemoOrganization(current.organizationId)) {
      return { ok: false, message: "Na demonstração o e-mail de acesso não muda." };
    }
    // Com a verificacao ligada, so a sessao que ja passou pelo segundo fator.
    if ((await secondFactorState(supabase, user)) === "missing") return { ok: false, message: SESSION_EXPIRED };
    if (!(await checkRateLimit({ key: `email_change:${user.id}`, maxRequests: 5, windowSeconds: 900 }))) {
      return { ok: false, message: TOO_MANY };
    }

    const currentEmail = user.email ?? "";
    // Formato do e-mail antes da senha: "asdasd" respondia "Senha incorreta" (10/11/2026).
    if (!isValidEmail(normalizeEmail(input.newEmail))) {
      return { ok: false, message: "Informe um e-mail válido.", field: "newEmail" };
    }
    if (isGoogleOnlyUser(user)) {
      const code = (input.code ?? "").replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) return { ok: false, message: "Digite os 6 números do e-mail.", field: "code" };
      const check = await verifyEmailCode(createSupabaseAdminClient(), user.id, "email_change", code);
      if (check !== "ok") {
        const message =
          check === "locked"
            ? "Muitas tentativas com este código. Peça um código novo."
            : check === "expired"
              ? "Este código venceu. Peça um código novo."
              : "Código inválido. Confira o e-mail e tente de novo.";
        return { ok: false, message, field: "code" };
      }
    } else if (!input.password || !(await passwordMatches(currentEmail, input.password))) {
      return { ok: false, message: "Senha incorreta.", field: "password" };
    }

    try {
      const admin = createSupabaseAdminClient();
      const created = await createEmailChangeToken(admin, {
        authUserId: user.id,
        currentEmail,
        newEmail: input.newEmail,
      });
      if (!created.ok) {
        switch (created.code) {
          case "invalid":
            return { ok: false, message: "Informe um e-mail válido.", field: "newEmail" };
          case "same":
            return { ok: false, message: "Este já é o seu e-mail de acesso.", field: "newEmail" };
          case "in_use":
            return { ok: false, message: "Este e-mail já é usado por outra conta.", field: "newEmail" };
          default:
            return { ok: false, message: "Não foi possível pedir a troca. Tente novamente." };
        }
      }
      const confirmUrl = `${await resolveAppBaseUrl()}/confirm-email?token=${created.token}`;
      const sent = await sendEmailChangeConfirmEmail({
        toEmail: created.newEmail,
        toName: current.name,
        confirmUrl,
      });
      if (!sent.ok) {
        await discardEmailChangeToken(admin, created.token);
        return { ok: false, message: sent.error };
      }
      await recordAuditLogInDb({
        action: "updated",
        target: { type: "user", id: current.id, label: current.name, profile: current.profile },
        predicate: "pediu para trocar o e-mail de acesso",
        security: true,
      });
      return { ok: true, newEmail: created.newEmail };
    } catch (err) {
      logError("[email-change] Erro ao pedir a troca:", err);
      return { ok: false, message: "Não foi possível pedir a troca. Tente novamente." };
    }
  });
}

export type ConfirmEmailChangeResult =
  | { ok: true; newEmail: string }
  | { ok: false; message: string; expired?: boolean };

/**
 * Confirma pelo link do e-mail novo (pode ser aberto sem estar logado, como o
 * de nova senha). O botao na pagina evita que o leitor de links do e-mail
 * confirme sozinho ao abrir a mensagem.
 */
export async function confirmAccessEmailChangeAction(input: {
  token: string;
  /** So para quem entrava pelo Google: a senha nova. */
  password?: string;
}): Promise<ConfirmEmailChangeResult> {
  return withErrorScope(async () => {
    const ip = await getClientIp();
    if (!(await checkRateLimit({ key: `email_change_confirm:${ip}`, maxRequests: 10, windowSeconds: 600 }))) {
      return { ok: false, message: TOO_MANY };
    }
    const admin = createSupabaseAdminClient();
    const result = await confirmEmailChange(admin, input.token, new Date(), { password: input.password });
    if (!result.ok) {
      switch (result.code) {
        case "expired":
        case "invalid":
          return { ok: false, message: "Este link venceu ou já foi usado. Peça a troca de novo.", expired: true };
        case "in_use":
          return { ok: false, message: "Este e-mail passou a ser usado por outra conta. Peça a troca com outro e-mail." };
        case "needs_password":
          return { ok: false, message: `Crie uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
        default:
          return { ok: false, message: "Não foi possível trocar o e-mail. Tente novamente." };
      }
    }
    // Aviso ao e-mail antigo, depois da resposta: falha no envio nao desfaz a
    // troca (fica no registro de erros).
    await afterResponse("Aviso ao e-mail antigo", async () => {
      const notice = await sendEmailChangedNoticeEmail({
        toEmail: result.oldEmail,
        toName: result.name,
        maskedNewEmail: maskEmail(result.newEmail),
      });
      if (!notice.ok) logError("[email-change] Aviso ao e-mail antigo não saiu:", notice.error);
    });
    return { ok: true, newEmail: normalizeEmail(result.newEmail) };
  });
}
