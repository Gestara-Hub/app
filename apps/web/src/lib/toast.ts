import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * `toast` do app: igual ao do sonner, mas o aviso de erro inesperado (o que traz
 * "Código do erro: K7Q2M9XD", doc technical/21) ganha o botão "Relatar problema".
 * Um toque abre o Fale com a gente com o código e a tela, e a equipe vê o erro
 * na hora em que aconteceu. Quem liga o botão é o app (`setErrorReporter`, no
 * SupportHost); sem ele (testes, páginas públicas) o aviso sai como sempre.
 * Importe sempre daqui, nunca de "sonner" (um teste confere).
 */
type ErrorReporter = (reference: string) => void;
let reporter: ErrorReporter | undefined;

export function setErrorReporter(next: ErrorReporter | undefined): void {
  reporter = next;
}

const REFERENCE = /Código do erro: ([A-Z0-9]{8})\b/;

/** O código do erro dentro da mensagem, se houver. */
export function referenceOf(message: unknown): string | undefined {
  return typeof message === "string" ? REFERENCE.exec(message)?.[1] : undefined;
}

/** Tempo na tela do aviso com botão: o dobro do padrão, para dar tempo de tocar. */
const REPORTABLE_DURATION_MS = 10_000;

type Message = Parameters<typeof sonnerToast.error>[0];

function error(message: Message, data?: ExternalToast) {
  const reference = referenceOf(message);
  if (!reporter || !reference || data?.action) return sonnerToast.error(message, data);
  const report = reporter;
  return sonnerToast.error(message, {
    duration: REPORTABLE_DURATION_MS,
    ...data,
    action: { label: "Relatar problema", onClick: () => report(reference) },
  });
}

export const toast = Object.assign((...args: Parameters<typeof sonnerToast>) => sonnerToast(...args), sonnerToast, { error });
