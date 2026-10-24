import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira: sem cookie de login do painel, tudo vai para /login. A
 * conferencia de verdade (sessao, administrador, tempo, segundo fator) e feita
 * no servidor, em cada pagina e action (`getAdminContext`).
 */
// /api/cron/* se protege sozinho (segredo no cabecalho), sem cookie de login.
const PUBLIC_PATHS = ["/login", "/session/end", "/accept", "/api/cron"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("gestara-admin"));
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
