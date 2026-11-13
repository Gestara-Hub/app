/**
 * O aparelho lembra das inscricoes feitas nele (12/11/2026): quem reabre o link
 * do evento ve "Voce se inscreveu neste aparelho" com o ingresso, sem impedir
 * outra inscricao (um filho, um amigo). So o codigo e o nome mascarado; sem
 * armazenamento (aba anonima), nada e lembrado.
 */

export interface RememberedSignup {
  ticketCode: string;
  /** Nome mascarado ("Ana S."), como na confirmacao. */
  displayName: string;
}

const MAX_PER_EVENT = 5;
const keyOf = (eventCode: string) => `gestarahub:event-signup:${eventCode}`;

export function readRememberedSignups(eventCode: string): RememberedSignup[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(keyOf(eventCode)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RememberedSignup =>
        typeof item?.ticketCode === "string" && /^[A-Z0-9]{8,32}$/.test(item.ticketCode) && typeof item?.displayName === "string",
    );
  } catch {
    return [];
  }
}

export function rememberSignup(eventCode: string, signup: RememberedSignup): void {
  try {
    const others = readRememberedSignups(eventCode).filter((item) => item.ticketCode !== signup.ticketCode);
    window.localStorage.setItem(keyOf(eventCode), JSON.stringify([signup, ...others].slice(0, MAX_PER_EVENT)));
  } catch {
    // sem armazenamento: o endereco do ingresso continua valendo
  }
}
