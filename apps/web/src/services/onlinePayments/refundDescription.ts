/**
 * Motivo mandado ao Asaas (aparece no detalhe da cobranca estornada la). Sempre
 * termina com a marca do app, com ou sem o motivo escrito: separa o estorno
 * feito pelo GestaraHub do feito direto no painel do Asaas.
 */
const REFUND_MARK = "Estorno pelo GestaraHub";

export function refundDescription(reason?: string): string {
  const written = typeof reason === "string" ? reason.trim().slice(0, 120) : "";
  return written ? `${written} · ${REFUND_MARK}` : REFUND_MARK;
}
