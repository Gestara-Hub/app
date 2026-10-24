"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Id, SubscriptionTier, UserView } from "@gestarahub/contracts";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  encodeSession,
  safeRedirectPath,
} from "@/lib/session";
import {
  SUBSCRIPTION_COOKIE,
  encodeTierCookie,
  isSubscriptionTier,
} from "@/lib/subscription";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { forgetCurrentSessionVerification } from "@/lib/security/second-factor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { discardUnstartedOwnerAccount } from "@/services/server/accountSetup";
import { logError } from "@/lib/log";

/**
 * Grava as claims do usuario no cookie de sessao. O client passa o `UserView`
 * completo (que ele ja tem do store do navegador) — nao ha lookup no server,
 * entao usuarios criados na UI tambem logam, nao so os do seed.
 */
async function setSession(user: UserView): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Login mockado: grava a sessao e redireciona. Nao valida senha (qualquer envio
 * entra). Vai para o destino original (`from`) quando permitido; senao, para a
 * primeira rota acessivel pelo perfil.
 */
export async function signIn(user: UserView, from?: string): Promise<void> {
  await setSession(user);

  const model = organizationModelById(user.organizationId) ?? "scheduling";
  // So caminho relativo do app (barra open redirect como "//evil.com").
  const safeFrom = safeRedirectPath(from);
  const target =
    safeFrom && canAccessRoute(user, safeFrom, model)
      ? safeFrom
      : firstAllowedRoute(user, model);
  redirect(target);
}

/** Troca o usuario logado (demo) e volta pra primeira rota do modelo do tenant. */
export async function switchUser(user: UserView): Promise<void> {
  await setSession(user);
  const model = organizationModelById(user.organizationId) ?? "scheduling";
  redirect(firstAllowedRoute(user, model));
}

/**
 * Regrava as claims do cookie sem redirecionar. Chamado pelo client quando o
 * proprio registro do usuario logado mudou no store (nome, perfil, vinculo),
 * para a sessao nao agir com um snapshot velho. O client faz `router.refresh()`
 * em seguida para o layout server reler as claims.
 */
export async function refreshSession(user: UserView): Promise<void> {
  await setSession(user);
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
}

/**
 * "Recusar e sair" do aviso de termos. Conta recem-criada (Google ou e-mail)
 * que recusa antes da configuracao inicial e apagada; as demais so saem.
 */
export async function declineTermsAndSignOut(): Promise<void> {
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
}

/**
 * Logout: encerra a sessao do Supabase Auth, limpa o cookie de sessao e volta
 * para o login. A prova do segundo fator desta sessao acaba junto; o
 * dispositivo lembrado continua (doc 17).
 */
export async function signOut(): Promise<void> {
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
}
