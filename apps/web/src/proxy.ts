import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Guarda de rota mockada (Next 16: `proxy` substitui o antigo `middleware`).
 * Protege todas as rotas do app: sem cookie de sessao -> redireciona para
 * `/login` guardando o destino em `?from=`. Estando logado, `/login` redireciona
 * para o Dashboard. Como e mock, mantemos simples.
 */
// Landing e paginas legais sao publicas.
const PUBLIC_PATHS = ["/login", "/", "/terms", "/privacy"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  // Previa do link: o grupo (marketing) gera "/opengraph-image-<hash>".
  if (pathname.startsWith("/opengraph-image")) return true;
  return PUBLIC_PATHS.some(
    (path) => path !== "/" && (pathname === path || pathname.startsWith(`${path}/`)),
  );
}

/**
 * Telas do app (pedem sessao). Endereco que nao existe segue para o 404 do
 * Next, em vez de mandar ao login (ONB-27).
 */
const APP_PATHS = [
  "/appointments",
  "/audit",
  "/classes",
  "/clients",
  "/communication",
  "/dashboard",
  "/finance",
  "/online-payments",
  "/reports",
  "/schedule",
  "/services",
  "/settings",
  "/setup",
  "/team",
  "/users",
];

function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const publicPath = isPublic(pathname);

  if (!hasSession && !publicPath && isAppPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Destino relativo com a query original (filtros na URL); o login sanitiza.
    url.search = "";
    url.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Estar logado e visitar /login NAO redireciona aqui: a propria page decide
  // (so redireciona se o cookie resolver um usuario valido). Evita loop quando
  // o cookie e stale/invalido — o proxy so garante presenca do cookie.
  return NextResponse.next();
}

export const config = {
  // Roda em tudo, exceto assets e arquivos internos do Next.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
