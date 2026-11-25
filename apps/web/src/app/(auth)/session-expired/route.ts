import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeRedirectPath } from "@/lib/session";
import { SUBSCRIPTION_COOKIE } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sessao do banco vencida com o cookie do app ainda vivo (25/11/2026): a casca
 * abria e toda leitura voltava "Sua sessão expirou", com a tela vazia ate sair e
 * entrar. O layout e a tela mandam para ca: limpa os dois lados e leva ao login
 * com o aviso e o endereco de volta. So para o proprio site (link de fora nao
 * desloga ninguem).
 */
export async function GET(request: NextRequest) {
  const from = safeRedirectPath(request.nextUrl.searchParams.get("from"));
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  try {
    // So esta sessao (local): as dos outros aparelhos seguem como estao.
    await (await createSupabaseServerClient()).auth.signOut({ scope: "local" });
  } catch {
    // Segue limpando os cookies do app.
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("expired", "1");
  if (from) login.searchParams.set("from", from);
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SUBSCRIPTION_COOKIE);
  // Os cookies da sessao do Supabase tambem saem na propria resposta.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) response.cookies.delete(cookie.name);
  }
  return response;
}
