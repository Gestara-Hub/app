import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/server/supabase";
import { SESSION_STARTED_COOKIE } from "@/lib/session-token";

/**
 * Encerra uma sessao que nao vale mais (venceu as 8 horas, a conta deixou de
 * ser administradora ou o cookie de tempo nao confere) e volta ao login. Rota
 * em vez de pagina porque so rota pode gravar cookie.
 */
const REASONS = new Set(["expired", "invalid", "not_admin"]);

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_STARTED_COOKIE);
  const reason = request.nextUrl.searchParams.get("reason") ?? "";
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = REASONS.has(reason) ? `?reason=${reason}` : "";
  return NextResponse.redirect(url);
}
