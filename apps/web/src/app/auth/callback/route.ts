import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, encodeSession, safeRedirectPath } from "@/lib/session";
import { loadSessionPayload, resolveGoogleAccount } from "@/services/server/accountSetup";

/**
 * Volta do Google ("Continuar com Google", doc 16): troca o codigo pela sessao
 * do Supabase, escolhe a conta (convite, conta existente ou espaco novo) e
 * grava a sessao do app. Qualquer falha volta para o login com o motivo.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?google_error=${reason}`, url.origin));

  const code = url.searchParams.get("code");
  if (!code) return fail(url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    console.error("[auth] Erro na volta do Google:", error);
    return fail("failed");
  }

  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(metadata.full_name || metadata.name || data.user.email.split("@")[0]).trim();
  const admin = createSupabaseAdminClient();
  const result = await resolveGoogleAccount(
    admin,
    { authUserId: data.user.id, email: data.user.email, name },
    url.searchParams.get("invite") ?? undefined,
  );
  if (!result.ok) {
    await supabase.auth.signOut();
    return fail(result.code);
  }

  const { user, organization } = await loadSessionPayload(admin, result.dbUser);
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const needsSetup = user.profile === "owner" && !organization.settings?.onboardingCompleted;
  const from = safeRedirectPath(url.searchParams.get("from"));
  const redirectTo = needsSetup
    ? "/setup"
    : from && canAccessRoute(user, from, organization.model)
      ? from
      : firstAllowedRoute(user, organization.model);
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
