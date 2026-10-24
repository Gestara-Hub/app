import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { SESSION_MAX_AGE_SECONDS } from "../session-token";

/** Nome proprio dos cookies de login do painel (no local, o app dos clientes usa o mesmo host). */
export const AUTH_COOKIE_NAME = "gestara-admin";

/**
 * Cliente do Supabase Auth para o painel (servidor). So autentica: os dados do
 * painel saem de `sql()`. Sessao de 8 horas, como o cookie de inicio.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getEnv();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME, maxAge: SESSION_MAX_AGE_SECONDS, sameSite: "strict", path: "/" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component: o proxy renova o token.
        }
      },
    },
  });
}
