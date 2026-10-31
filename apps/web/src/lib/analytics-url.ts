/**
 * Endereco limpo para a analise de uso (auditoria de 30/10/2026). O PostHog
 * guardava o endereco de cada pagina: tokens de redefinicao de senha, de
 * convite e de cadastro, o e-mail da recuperacao de senha e o id dos links
 * publicos (autorizacao do menor, fatura, comprovante), que abrem dados de
 * alunos. Sai o valor desses parametros e o trecho do link publico vira um
 * marcador. Puro: usado no `before_send` do PostHog.
 */
const SENSITIVE_PARAMS = new Set(["token", "signup_token", "access_token", "refresh_token", "code", "email", "cpf", "phone"]);

const PUBLIC_PATHS: [RegExp, string][] = [
  [/^\/consent\/minor\/[^/?#]+/, "/consent/minor/:id"],
  [/^\/p\/c\/[^/?#]+/, "/p/c/:id"],
  [/^\/p\/(?!c\/)[^/?#]+/, "/p/:code"],
];

export function scrubAnalyticsUrl(value: string): string {
  if (!value) return value;
  let url: URL;
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  try {
    url = new URL(value, "https://placeholder.invalid");
  } catch {
    return value;
  }
  for (const [pattern, replacement] of PUBLIC_PATHS) {
    if (pattern.test(url.pathname)) url.pathname = url.pathname.replace(pattern, replacement);
  }
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_PARAMS.has(key.toLowerCase())) url.searchParams.set(key, "[removido]");
  }
  const path = `${url.pathname}${url.search}${url.hash}`;
  return absolute ? `${url.origin}${path}` : path;
}

/** Propriedades do evento que levam endereco. */
export const URL_PROPERTIES = ["$current_url", "$pathname", "$referrer", "$initial_referrer", "$initial_current_url", "$prev_pageview_pathname"];
