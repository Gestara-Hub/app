/**
 * Sugestao de instalar o app (PWA), decisao de 04/11/2026 (doc technical/10):
 * quem usa pelo navegador, no celular ou no computador, ve um cartao para
 * instalar. Regras puras aqui; a tela fica em `components/layout/install-app-prompt`.
 *
 * - "prompt": navegadores com a janela de instalacao propria (Chrome, Edge,
 *   Samsung). O cartao chama a janela do navegador.
 * - "ios": iPhone e iPad nao tem botao de instalar; o cartao ensina o caminho
 *   (Compartilhar, Adicionar a Tela de Inicio).
 * - "mac-safari": Safari do Mac instala pelo menu Arquivo, Adicionar ao Dock.
 * - null: ja instalado ou navegador sem instalacao (Firefox no computador).
 */
export type InstallPlatform = "prompt" | "ios" | "mac-safari";

export function installPlatform(input: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  canPrompt: boolean;
}): InstallPlatform | null {
  if (input.standalone) return null;
  if (input.canPrompt) return "prompt";
  const ua = input.userAgent;
  // iPadOS se apresenta como Mac; o toque denuncia.
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && input.maxTouchPoints > 1);
  if (isIos) return "ios";
  const isMacSafari =
    /Macintosh/.test(ua) && /Version\/\d+.*Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(ua);
  if (isMacSafari) return "mac-safari";
  return null;
}

/** Depois do "Agora nao", volta em 14 dias; na terceira recusa, para de sugerir. */
export const INSTALL_SNOOZE_DAYS = 14;
export const INSTALL_MAX_DISMISSALS = 3;

export interface InstallPromptState {
  /** Data (AAAA-MM-DD) do ultimo "Agora nao". */
  dismissedAt?: string;
  dismissals?: number;
}

export function shouldOfferInstall(state: InstallPromptState | undefined, today: string): boolean {
  const dismissals = state?.dismissals ?? 0;
  if (dismissals >= INSTALL_MAX_DISMISSALS) return false;
  if (!state?.dismissedAt) return true;
  return daysBetween(state.dismissedAt, today) >= INSTALL_SNOOZE_DAYS;
}

export function dismissInstall(state: InstallPromptState | undefined, today: string): InstallPromptState {
  return { dismissedAt: today, dismissals: (state?.dismissals ?? 0) + 1 };
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : INSTALL_SNOOZE_DAYS;
}
