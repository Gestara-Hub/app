import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Organization, Unit, UserView } from "@gestarahub/contracts";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { currentSessionId, markSessionVerified, secondFactorState } from "@/lib/security/second-factor";
import { TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_TTL_MS } from "@/lib/security/two-factor-rules";
import { SESSION_COOKIE, safeRedirectPath } from "@/lib/session";
import { encodeSession, sessionCookieOptions } from "@/lib/session-cookie";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadSessionPayload } from "@/services/server/accountSetup";
import { rememberDevice, consumeTrustedDevice } from "@/services/server/twoFactor";

/**
 * Final do login, comum a senha e codigo da verificacao em duas etapas (doc
 * 17). Modulo so do servidor, sem "use server": nada aqui pode virar action
 * chamavel pelo navegador (criaria a sessao de qualquer usuario).
 */

export type SignInSessionResult =
  | { ok: true; redirectTo: string; user: UserView; organization: Organization; unit: Unit; categories: Category[] }
  | { ok: false; message: string };

/**
 * A sessao do Supabase precisa do segundo fator? Senha certa com o app ou o
 * e-mail ligado ainda nao passou por ele (`secondFactorState`). Um dispositivo
 * lembrado e valido conta como feito: grava a prova desta sessao e segue.
 */
export async function needsSecondFactor(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await secondFactorState(supabase, user)) !== "missing") return false;
  return !(await passWithTrustedDevice(supabase, user.id));
}

async function trustedDeviceToken(): Promise<string | undefined> {
  try {
    return (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
  } catch {
    // Fora de uma requisicao (testes): sem cookie.
    return undefined;
  }
}

async function passWithTrustedDevice(supabase: SupabaseClient, authUserId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!(await consumeTrustedDevice(admin, authUserId, await trustedDeviceToken()))) return false;
  const sessionId = await currentSessionId(supabase);
  return sessionId ? markSessionVerified(admin, authUserId, sessionId, "device") : false;
}

/** "Lembrar este dispositivo por 30 dias": grava o dispositivo e o cookie. */
export async function rememberThisDevice(authUserId: string, userAgent: string | null): Promise<void> {
  const device = await rememberDevice(createSupabaseAdminClient(), authUserId, userAgent);
  if (!device) return;
  (await cookies()).set(TRUSTED_DEVICE_COOKIE, device.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Relativo (nao a data): relogio do navegador diferente do servidor nao vence o cookie antes.
    maxAge: Math.floor(TRUSTED_DEVICE_TTL_MS / 1000),
  });
}

export async function readTrustedDeviceToken(): Promise<string | undefined> {
  return trustedDeviceToken();
}

export async function clearTrustedDeviceCookie(): Promise<void> {
  (await cookies()).delete(TRUSTED_DEVICE_COOKIE);
}

/** Confere o usuario no espaco, grava a sessao do app e escolhe para onde ir. */
export async function finishSignIn(
  admin: SupabaseClient,
  authUserId: string,
  from?: string,
): Promise<SignInSessionResult> {
  // Convidado tem id proprio no app, ligado a conta pelo auth_user_id (como em requireTenant).
  const { data: rows, error: userErr } = await admin
    .from("users")
    .select("*")
    .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`);
  const dbUser = rows?.find((row) => row.auth_user_id === authUserId) ?? rows?.[0];

  if (userErr || !dbUser) {
    return { ok: false, message: "Usuário não encontrado na organização." };
  }
  if (dbUser.status === "inactive") {
    return { ok: false, message: "Sua conta está inativa. Procure o responsável pelo espaço." };
  }

  // Espaco inativado pelo painel do GestaraHub (encerramento, LGPD): avisa em vez de voltar mudo ao login.
  const { data: space } = await admin.from("organizations").select("status").eq("id", dbUser.organization_id).maybeSingle();
  if (space?.status && space.status !== "active") {
    return { ok: false, message: "Este espaço está inativo. Fale com o suporte do GestaraHub para reativar." };
  }

  const { user, organization, unit, categories } = await loadSessionPayload(admin, dbUser);
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());

  const needsSetup = user.profile === "owner" && !organization.settings?.onboardingCompleted;
  const safeFrom = safeRedirectPath(from);
  const redirectTo = needsSetup
    ? "/setup"
    : safeFrom && canAccessRoute(user, safeFrom, organization.model)
      ? safeFrom
      : firstAllowedRoute(user, organization.model);

  return { ok: true, user, organization, unit, categories, redirectTo };
}
