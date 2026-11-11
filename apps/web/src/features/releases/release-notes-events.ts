/**
 * Abrir a gaveta de Novidades de qualquer lugar (a versao na sidebar, doc
 * technical/27). A gaveta mora no topo do app (`app-topbar`), que escuta.
 */
const OPEN_EVENT = "gestarahub:open-release-notes";

export function openReleaseNotes(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenReleaseNotes(handler: () => void): () => void {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
