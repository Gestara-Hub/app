/**
 * Dica do menu da conta (o avatar no topo), decisao de 31/10/2026: aparece uma
 * vez por pessoa, no primeiro destes momentos:
 * - "security": logo depois do "Agora não" no aviso das duas etapas;
 * - "support": com uma resposta do suporte ainda nao lida;
 * - "second_day": no Painel, a partir do segundo dia de uso.
 * No maximo uma interrupcao por acesso: o "security" e a continuacao do
 * proprio aviso; os outros esperam o proximo acesso.
 */
export type AccountMenuTipReason = "security" | "support" | "second_day";

export interface AccountMenuTipState {
  firstSeenAt?: string;
  shownAt?: string;
}

export function accountMenuTipReason(input: {
  state: AccountMenuTipState | undefined;
  today: string;
  requested: AccountMenuTipReason | null;
  supportUnread: number;
  onDashboard: boolean;
  interruptedThisSession: boolean;
}): AccountMenuTipReason | null {
  const { state, today } = input;
  if (state?.shownAt) return null;
  if (input.requested === "security") return "security";
  if (input.interruptedThisSession) return null;
  if (input.supportUnread > 0) return "support";
  if (input.onDashboard && state?.firstSeenAt && state.firstSeenAt < today) return "second_day";
  return null;
}

// Pedido de quem esta em outra parte da tela (o aviso de seguranca).
type Listener = (reason: AccountMenuTipReason) => void;
const listeners = new Set<Listener>();

export function requestAccountMenuTip(reason: AccountMenuTipReason): void {
  for (const listener of listeners) listener(reason);
}

export function onAccountMenuTipRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Algo ja interrompeu a pessoa neste acesso (aviso de seguranca, dica). */
const INTERRUPTED_KEY = "gestarahub:interrupted-this-session";

export function markInterruption(): void {
  try {
    window.sessionStorage.setItem(INTERRUPTED_KEY, "1");
  } catch {
    // Sem armazenamento: a dica pode vir no mesmo acesso.
  }
}

export function interruptedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(INTERRUPTED_KEY) === "1";
  } catch {
    return false;
  }
}
