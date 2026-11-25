import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/client";
import { SESSION_COOKIE } from "@/lib/session";
import { PATHNAME_HEADER } from "@/lib/request-path";

/**
 * Guarda de rota mockada (Next 16: `proxy` substitui o antigo `middleware`).
 * Protege todas as rotas do app: sem cookie de sessao -> redireciona para
 * `/login` guardando o destino em `?from=`. Estando logado, `/login` redireciona
 * para o Dashboard. Como e mock, mantemos simples.
 */
// Landing, paginas legais, termo de consentimento publico, aceite de convites e a abertura do app instalado (/launch) sao publicos.
const PUBLIC_PATHS = ["/login", "/", "/terms", "/privacy", "/consent", "/accept-invite", "/launch"];

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
  "/certificates",
  "/classes",
  "/clients",
  "/communication",
  "/dashboard",
  "/events",
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

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/** Cookie da sessao do Supabase (`sb-<projeto>-auth-token`, as vezes em partes). */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

/**
 * Renova a sessao do Supabase antes da tela (25/11/2026). Antes ninguem renovava
 * aqui: o token de 1 hora vencia e quem renovava era o layout do servidor, que
 * nao pode gravar cookie. O Supabase trocava o token de renovacao, o navegador
 * ficava com o antigo e, passado o prazo de reuso (10 s), a sessao inteira caia.
 * Depois de dias sem usar, a tela abria vazia ate sair e entrar de novo.
 * Aqui os cookies novos vao para a requisicao (o layout ja le os novos) e para
 * a resposta (o navegador guarda). Token valido: so le o cookie, sem ida ao Auth.
 */
async function refreshSupabaseSession(request: NextRequest): Promise<CookieToSet[]> {
  const written: CookieToSet[] = [];
  try {
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            if (cookie.value) request.cookies.set(cookie.name, cookie.value);
            else request.cookies.delete(cookie.name);
            written.push(cookie);
          }
        },
      },
    });
    await supabase.auth.getSession();
  } catch {
    // Sem o Auth agora: segue; a acao confere a sessao de novo.
  }
  return written;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
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
  // O caminho vai para o layout do app (11/11/2026): a guarda de modelo e
  // permissao roda la, antes do `loading.tsx` (ver `app/(app)/layout.tsx`).
  const refreshed = hasSession && hasSupabaseSession(request) ? await refreshSupabaseSession(request) : [];
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname);
  const response = NextResponse.next({ request: { headers } });
  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
  return response;
}

export const config = {
  // Roda em tudo, exceto assets e arquivos internos do Next.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
