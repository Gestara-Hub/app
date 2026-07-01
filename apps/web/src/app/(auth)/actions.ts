"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { store } from "@/mocks/store";

/**
 * Login mockado: grava o `userId` no cookie de sessao e redireciona. Nao valida
 * senha (qualquer envio entra), mas o `userId` precisa existir. Vai para o
 * destino original (`from`) quando permitido; senao, para a primeira rota
 * acessivel pelo perfil.
 */
export async function signIn(userId: string, from?: string): Promise<void> {
  const user = store.users.find((u) => u.id === userId);
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const target =
    from && from.startsWith("/") && canAccessRoute(user, from)
      ? from
      : firstAllowedRoute(user);
  redirect(target);
}

/** Troca o usuario logado (demo) e volta pra primeira rota do novo perfil. */
export async function switchUser(userId: string): Promise<void> {
  const user = store.users.find((u) => u.id === userId);
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(firstAllowedRoute(user));
}

/** Logout mockado: limpa o cookie de sessao e volta para o login. */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
