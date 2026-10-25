/**
 * Numero de protocolo das conversas do suporte: "GH-1042" para quem fala com o cliente e para o
 * cliente citar; no banco e so o inteiro (`platform.support_threads.number`).
 */
export const SUPPORT_PROTOCOL_PREFIX = "GH-";

export const formatProtocol = (number: number): string => `${SUPPORT_PROTOCOL_PREFIX}${number}`;

/** Aceita "GH-1042", "gh1042", "#1042" e "1042" (so o numero); qualquer outra coisa devolve null. */
export function parseProtocol(text: string | null | undefined): number | null {
  const match = /^\s*(?:gh\s*-?\s*|#\s*)?(\d{1,9})\s*$/i.exec(text ?? "");
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return number > 0 ? number : null;
}
