import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, safeRedirectPath } from "@/lib/session";
import { encodeSession, sessionCookieOptions } from "@/lib/session-cookie";
import { loadSessionPayload, resolveGoogleAccount } from "@/services/server/accountSetup";
import { needsSecondFactor } from "@/app/(auth)/sign-in-session";
import { logError } from "@/lib/log";

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
    logError("[auth] Erro na volta do Google:", error);
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

  // Conta com senha e Google que ligou a verificacao em duas etapas (doc 17):
  // a sessao do app so nasce depois do codigo.
  if (await needsSecondFactor(supabase)) {
    const from = safeRedirectPath(url.searchParams.get("from"));
    return NextResponse.redirect(new URL(`/two-factor${from ? `?from=${encodeURIComponent(from)}` : ""}`, url.origin));
  }

  const { user, organization } = await loadSessionPayload(admin, result.dbUser);
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());

  const needsSetup = user.profile === "owner" && !organization.settings?.onboardingCompleted;
  const from = safeRedirectPath(url.searchParams.get("from"));
  const redirectTo = needsSetup
    ? "/setup"
    : from && canAccessRoute(user, from, organization.model)
      ? from
      : firstAllowedRoute(user, organization.model);
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
