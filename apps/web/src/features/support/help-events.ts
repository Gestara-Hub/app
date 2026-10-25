/** Abrir a ajuda de qualquer tela (botão "?" e menu do usuário) e pedir o tour do Painel de novo. */
const OPEN = "gestarahub:open-help";
const TOUR = "gestarahub:replay-tour";
const GUIDE = "gestarahub:start-guide";

export function openHelp(): void {
  window.dispatchEvent(new CustomEvent(OPEN));
}

export function onOpenHelp(handler: () => void): () => void {
  window.addEventListener(OPEN, handler);
  return () => window.removeEventListener(OPEN, handler);
}

/** "Rever o tour": quem monta o tour (Painel, proprietário) escuta com `onReplayTour`. */
export function replayTour(): void {
  window.dispatchEvent(new CustomEvent(TOUR));
}

export function onReplayTour(handler: () => void): () => void {
  window.addEventListener(TOUR, handler);
  return () => window.removeEventListener(TOUR, handler);
}

/** "Me mostre": `chunkId` é o trecho da ajuda com guia; quem monta o guia na tela (HelpHost) escuta com `onStartGuide`. */
export function startGuide(chunkId: string): void {
  window.dispatchEvent(new CustomEvent<string>(GUIDE, { detail: chunkId }));
}

export function onStartGuide(handler: (chunkId: string) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<string>).detail);
  window.addEventListener(GUIDE, listener);
  return () => window.removeEventListener(GUIDE, listener);
}
