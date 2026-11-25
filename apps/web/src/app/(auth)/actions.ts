"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Id, SubscriptionTier, UserView } from "@gestarahub/contracts";
import { SESSION_COOKIE, SESSION_MAX_AGE, isSupabaseOrganization } from "@/lib/session";
import { encodeSession, sessionCookieOptions } from "@/lib/session-cookie";
import {
  SUBSCRIPTION_COOKIE,
  encodeTierCookie,
  isSubscriptionTier,
} from "@/lib/subscription";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { forgetCurrentSessionVerification } from "@/lib/security/second-factor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { discardUnstartedOwnerAccount, loadSessionPayload } from "@/services/server/accountSetup";
import { logError, withErrorScope } from "@/lib/log";

/**
 * Regrava as claims do cookie sem redirecionar, quando o proprio registro do
 * usuario logado mudou (nome, perfil, vinculo). O client faz `router.refresh()`
 * em seguida para o layout server reler as claims.
 *
 * Revisao geral de 31/10/2026 (achado S1): antes o cookie era assinado com o
 * `UserView` que o navegador mandasse, e um professor montava a sessao do dono.
 * Conta real: as claims saem do banco, sempre para o usuario da sessao atual
 * (o argumento e ignorado). Demonstracao (sem banco): so aceita o mesmo usuario
 * e o mesmo espaco da sessao atual. `signIn` e `switchUser`, sobras do
 * prototipo sem uso, sairam pelo mesmo motivo.
 */
export async function refreshSession(user: UserView): Promise<void> {
  return withErrorScope(async () => {
    const current = await getCurrentUser();
    if (!current) return;
    let next: UserView | null = null;
    if (isSupabaseOrganization(current.organizationId)) {
      const admin = createSupabaseAdminClient();
      const { data: dbUser } = await admin
        .from("users")
        .select("*")
        .eq("id", current.id)
        .eq("organization_id", current.organizationId)
        .maybeSingle();
      if (!dbUser || dbUser.status !== "active") return;
      next = (await loadSessionPayload(admin, dbUser)).user;
    } else if (user.id === current.id && user.organizationId === current.organizationId) {
      next = user;
    }
    if (!next) return;
    (await cookies()).set(SESSION_COOKIE, encodeSession(next), sessionCookieOptions());
  });
}

/**
 * Espelha o tier do plano GestaraHub (que vive no store do navegador) num
 * cookie, para as pages server decidirem entre a tela paga e o upsell. So
 * aceita a organizacao da propria sessao. O client faz `router.refresh()`
 * em seguida.
 */
export async function syncSubscriptionTier(
  organizationId: Id,
  tier: SubscriptionTier,
): Promise<void> {
  return withErrorScope(async () => {
    const session = await getCurrentUser();
    const cookieStore = await cookies();
    if (!session || session.organizationId !== organizationId) return;
    if (!isSubscriptionTier(tier)) return;
    cookieStore.set(SUBSCRIPTION_COOKIE, encodeTierCookie(organizationId, tier), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  });
}

/**
 * "Recusar e sair" do aviso de termos. Conta recem-criada (Google ou e-mail)
 * que recusa antes da configuracao inicial e apagada; as demais so saem.
 */
export async function declineTermsAndSignOut(): Promise<void> {
  return withErrorScope(async () => {
    try {
      const supabase = await createSupabaseServerClient();
      // Identidade conferida no Supabase Auth, nao no cookie do app.
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await discardUnstartedOwnerAccount(createSupabaseAdminClient(), data.user.id);
      }
    } catch (err) {
      logError("[auth] Erro ao descartar conta recusada:", err);
    }
    await signOut();
  });
}

/**
 * Logout: encerra a sessao do Supabase Auth, limpa o cookie de sessao e volta
 * para o login. A prova do segundo fator desta sessao acaba junto; o
 * dispositivo lembrado continua (doc 17).
 */
export async function signOut(): Promise<void> {
  return withErrorScope(async () => {
    try {
      const supabase = await createSupabaseServerClient();
      await forgetCurrentSessionVerification(supabase);
      await supabase.auth.signOut();
    } catch {
      // Segue limpando os cookies locais
    }
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(SUBSCRIPTION_COOKIE);
    redirect("/login");
  });
}
