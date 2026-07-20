"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserView } from "@gestarahub/contracts";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  encodeSession,
} from "@/lib/session";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";

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
  const target =
    from && from.startsWith("/") && canAccessRoute(user, from, model)
      ? from
      : firstAllowedRoute(user, model);
  redirect(target);
}

/** Troca o usuario logado (demo) e volta pra primeira rota do modelo do tenant. */
export async function switchUser(user: UserView): Promise<void> {
  await setSession(user);
  const model = organizationModelById(user.organizationId) ?? "scheduling";
  redirect(firstAllowedRoute(user, model));
}

/** Logout mockado: limpa o cookie de sessao e volta para o login. */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
