/**
 * Content-Security-Policy (decisao 5 da noite de 31/10/2026, confirmada pelo
 * usuario). Lista do que o navegador pode carregar: scripts, conexoes, imagens
 * e quadros so das origens daqui. Um script injetado nao busca codigo de fora
 * nem manda dados para outro endereco, e o app nao abre dentro de outro site.
 *
 * Script inline continua liberado ('unsafe-inline'): o Next grava os dados de
 * cada pagina em <script> inline, e as paginas de marketing sao estaticas. Um
 * nonce por pagina exigiria render dinamico em todas (doc
 * technical/00, "Cabeçalhos de segurança e CSP"). 'unsafe-eval' so no
 * `pnpm dev`, que o React usa para recarregar o codigo.
 *
 * Origens de fora e quem usa:
 * - Supabase (`NEXT_PUBLIC_SUPABASE_URL`): cliente do navegador e arquivos;
 * - PostHog (`NEXT_PUBLIC_POSTHOG_HOST` e `*.posthog.com`): analise de uso,
 *   so com o aceite, e o gravador de sessao que ele baixa;
 * - Meta (`connect.facebook.net`, `*.facebook.com`): cadastro do WhatsApp oficial;
 * - ViaCEP: endereco pelo CEP;
 * - Google Fonts: fontes escolhidas em Aparencia.
 */

export interface ContentSecurityPolicyEnv {
  isDev: boolean;
  supabaseUrl?: string;
  posthogHost?: string;
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function contentSecurityPolicy({ isDev, supabaseUrl, posthogHost }: ContentSecurityPolicyEnv): string {
  const supabase = originOf(supabaseUrl);
  const supabaseSocket = supabase?.replace(/^http/, "ws");
  const posthog = originOf(posthogHost ?? "https://us.i.posthog.com");
  const list = (...sources: (string | false | undefined)[]) =>
    [...new Set(sources.filter((s): s is string => Boolean(s)))].join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": list("'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", "https://connect.facebook.net", posthog, "https://*.posthog.com"),
    "style-src": list("'self'", "'unsafe-inline'", "https://fonts.googleapis.com"),
    "font-src": list("'self'", "data:", "https://fonts.gstatic.com"),
    "img-src": list("'self'", "data:", "blob:", "https:", supabase),
    "connect-src": list(
      "'self'",
      supabase,
      supabaseSocket,
      posthog,
      "https://*.posthog.com",
      "https://viacep.com.br",
      "https://graph.facebook.com",
      "https://*.facebook.com",
      // Recarga do codigo no `pnpm dev`.
      isDev && "ws:",
    ),
    "frame-src": "https://*.facebook.com",
    "worker-src": list("'self'", "blob:"),
    "media-src": list("'self'", "blob:"),
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
  };
  const policy = Object.entries(directives).map(([name, value]) => `${name} ${value}`);
  // Em producao, tudo em https (no `pnpm dev` o localhost e http).
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
