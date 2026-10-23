import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Organization, Unit, UserView } from "@gestarahub/contracts";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { SESSION_COOKIE, SESSION_MAX_AGE, encodeSession, safeRedirectPath } from "@/lib/session";
import { loadSessionPayload } from "@/services/server/accountSetup";

/**
 * Final do login, comum a senha e codigo da verificacao em duas etapas (doc
 * 17). Modulo so do servidor, sem "use server": nada aqui pode virar action
 * chamavel pelo navegador (criaria a sessao de qualquer usuario).
 */

export type SignInSessionResult =
  | { ok: true; redirectTo: string; user: UserView; organization: Organization; unit: Unit; categories: Category[] }
  | { ok: false; message: string };

/**
 * A sessao do Supabase precisa do segundo fator? Senha certa com app
 * autenticador ligado fica em AAL1 com AAL2 como proximo nivel.
 */
export async function needsSecondFactor(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/** Confere o usuario no espaco, grava a sessao do app e escolhe para onde ir. */
export async function finishSignIn(
  admin: SupabaseClient,
  authUserId: string,
  from?: string,
): Promise<SignInSessionResult> {
  const { data: dbUser, error: userErr } = await admin.from("users").select("*").eq("id", authUserId).maybeSingle();

  if (userErr || !dbUser) {
    return { ok: false, message: "Usuário não encontrado na organização." };
  }
  if (dbUser.status === "inactive") {
    return { ok: false, message: "Sua conta está inativa. Procure o responsável pelo espaço." };
  }

  const { user, organization, unit, categories } = await loadSessionPayload(admin, dbUser);
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const needsSetup = user.profile === "owner" && !organization.settings?.onboardingCompleted;
  const safeFrom = safeRedirectPath(from);
  const redirectTo = needsSetup
    ? "/setup"
    : safeFrom && canAccessRoute(user, safeFrom, organization.model)
      ? safeFrom
      : firstAllowedRoute(user, organization.model);

  return { ok: true, user, organization, unit, categories, redirectTo };
}
