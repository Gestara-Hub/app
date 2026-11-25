import type { ApiError } from "@gestarahub/contracts";

/**
 * Sessao do banco vencida (`FORBIDDEN` com 401: "Sua sessão expirou" ou falta
 * o segundo fator). O permissao negada e 403 e nao entra aqui.
 */
export function isSessionExpiredError(error: Pick<ApiError, "code" | "httpStatus"> | null | undefined): boolean {
  return error?.code === "FORBIDDEN" && error.httpStatus === 401;
}

let leaving = false;
let inAppSession = false;

/** Ligado pelo `SessionProvider`: so as telas logadas saem sozinhas. */
export function setInAppSession(value: boolean): void {
  inAppSession = value;
}

/**
 * Rede de seguranca da tela (25/11/2026): uma leitura ou gravacao que volta
 * "sessão expirou" leva ao login com o aviso e o endereco de volta, em vez de
 * deixar a tela vazia. Uma vez so, mesmo com varias leituras falhando juntas.
 */
export function leaveExpiredSession(): void {
  if (typeof window === "undefined" || leaving || !inAppSession) return;
  leaving = true;
  const from = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/session-expired?from=${encodeURIComponent(from)}`);
}
