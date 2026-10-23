/**
 * Pedido do aviso de seguranca (doc product/25, secao 5). Quem faz a acao pede
 * (`requestSecurityPrompt`); o `SecurityPromptHost`, no layout do app, decide
 * se mostra (perfil, ja ligado, conta do Google, "Agora não" recente).
 */

export type SecurityPromptReason = "online_payments" | "first_invite" | "password_reset" | "seven_days";

const EVENT = "gestarahub:security-prompt";
/** Senha nova e criada fora do app (tela de recuperacao): o pedido espera o proximo acesso. */
const PENDING_KEY = "gestarahub:security-prompt:pending";

export function requestSecurityPrompt(reason: SecurityPromptReason): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SecurityPromptReason>(EVENT, { detail: reason }));
}

/** Depois de criar a senha nova: o aviso aparece ao entrar no app. */
export function rememberPasswordReset(): void {
  try {
    window.localStorage.setItem(PENDING_KEY, "password_reset");
  } catch {
    // Sem armazenamento (aba privada): segue sem o aviso.
  }
}

/** Pedido guardado para o proximo acesso (e o apaga). */
export function takePendingSecurityPrompt(): SecurityPromptReason | null {
  try {
    const value = window.localStorage.getItem(PENDING_KEY);
    window.localStorage.removeItem(PENDING_KEY);
    return value === "password_reset" ? value : null;
  } catch {
    return null;
  }
}

export function onSecurityPromptRequest(handler: (reason: SecurityPromptReason) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<SecurityPromptReason>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** "Agora não" volta a perguntar depois disto, no maximo 3 vezes. */
export const SECURITY_PROMPT_REPEAT_DAYS = 30;
export const SECURITY_PROMPT_MAX_DISMISS = 3;
/** Dias de uso para o aviso sem evento. */
export const SECURITY_PROMPT_AFTER_DAYS = 7;

export interface SecurityPromptState {
  firstSeenAt?: string;
  dismissCount?: number;
  lastDismissedAt?: string;
}

/** Pode perguntar agora? (regra pura: o resto, perfil e ja ligado, o host confere). */
export function canAskSecurity(state: SecurityPromptState | undefined, today: string): boolean {
  const count = state?.dismissCount ?? 0;
  if (count >= SECURITY_PROMPT_MAX_DISMISS) return false;
  if (!state?.lastDismissedAt) return true;
  const days = (Date.parse(`${today}T12:00:00`) - Date.parse(`${state.lastDismissedAt}T12:00:00`)) / 86_400_000;
  return days >= SECURITY_PROMPT_REPEAT_DAYS;
}

/** Ja passou dos 7 dias de uso? */
export function usedLongEnough(state: SecurityPromptState | undefined, today: string): boolean {
  if (!state?.firstSeenAt) return false;
  const days = (Date.parse(`${today}T12:00:00`) - Date.parse(`${state.firstSeenAt}T12:00:00`)) / 86_400_000;
  return days >= SECURITY_PROMPT_AFTER_DAYS;
}
