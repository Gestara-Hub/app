/**
 * Ultima tela vista no app (25/11/2026): o app instalado reabre nela, e nao
 * sempre no Painel. Fica no `localStorage` deste aparelho, com a conta (usuario
 * e espaco) que a viu; outra conta, ou mais de 7 dias sem abrir, volta ao Painel.
 * So o endereco: nada de dado da tela.
 */
const LAST_ROUTE_KEY = "gestarahub:last-route";
const RESTORED_OWNER_KEY = "gestarahub:restored-owner";
export const LAST_ROUTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Parametros que abrem formulario: reabrir com ele pela metade nao vale. */
const FORM_PARAMS = /^(edit|new|create|novo|editar|criar)$/i;
/** Telas que nao sao "onde eu estava": configuracao inicial. */
const SKIPPED_PATHS = ["/setup"];

interface StoredRoute {
  owner: string;
  path: string;
  at: number;
}

/** Endereco guardavel: so do proprio app, sem parametro de formulario. */
export function rememberablePath(pathname: string, search: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  if (SKIPPED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) if (FORM_PARAMS.test(key)) params.delete(key);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function rememberRoute(owner: string, pathname: string, search: string, now = Date.now()): void {
  const path = rememberablePath(pathname, search);
  if (!path) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({ owner, path, at: now } satisfies StoredRoute));
  } catch {
    // Sem armazenamento: abre no Painel.
  }
}

/** Para a abertura do app: a tela guardada, se ainda vale. */
export function restorableRoute(now = Date.now()): StoredRoute | null {
  try {
    const raw = localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredRoute>;
    if (typeof stored.owner !== "string" || typeof stored.path !== "string" || typeof stored.at !== "number") return null;
    if (now - stored.at > LAST_ROUTE_MAX_AGE_MS) return null;
    const url = new URL(stored.path, "http://gestarahub.local");
    const path = rememberablePath(url.pathname, url.search);
    return path ? { owner: stored.owner, path, at: stored.at } : null;
  } catch {
    return null;
  }
}

/** A abertura levou a tela de uma conta: o app confere se e a mesma da sessao. */
export function markRestoredOwner(owner: string): void {
  try {
    sessionStorage.setItem(RESTORED_OWNER_KEY, owner);
  } catch {
    // nada
  }
}

/** Le e apaga a conta da tela reaberta (uma conferencia so). */
export function takeRestoredOwner(): string | null {
  try {
    const owner = sessionStorage.getItem(RESTORED_OWNER_KEY);
    sessionStorage.removeItem(RESTORED_OWNER_KEY);
    return owner;
  } catch {
    return null;
  }
}
