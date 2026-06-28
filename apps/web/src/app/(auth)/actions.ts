"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SESSION_VALUE,
} from "@/lib/session";

/**
 * Login mockado: nao valida credenciais (qualquer envio entra). Apenas grava o
 * cookie de sessao e redireciona para o destino original (`from`) ou o Dashboard.
 */
export async function signIn(from?: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const target = from && from.startsWith("/") ? from : "/";
  redirect(target);
}

/** Logout mockado: limpa o cookie de sessao e volta para o login. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
