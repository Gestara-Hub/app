/**
 * O código curto que a pessoa vê numa mensagem de erro inesperado ("Código do
 * erro: K7Q2M9XD", doc technical/21). Fica aqui, sem dependência de tela, para o
 * aviso de erro e o rastro de passos usarem o mesmo formato.
 */
const REFERENCE = /Código do erro: ([A-Z0-9]{8})\b/;

/** O código dentro da mensagem, se houver. */
export function referenceOf(message: unknown): string | undefined {
  return typeof message === "string" ? REFERENCE.exec(message)?.[1] : undefined;
}
