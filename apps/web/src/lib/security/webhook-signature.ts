import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Conferencia de segredos e assinaturas de webhook, so do servidor (auditoria
 * de 30/10/2026). Comparacao em tempo constante: `!==` deixa medir quantos
 * caracteres batem pelo tempo da resposta.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Assinatura da Meta (`X-Hub-Signature-256: sha256=<hex>`): HMAC-SHA256 do
 * corpo cru com o segredo do app. Sem ela, qualquer um mudava a situacao das
 * mensagens de qualquer espaco pelo id da mensagem.
 */
export function validMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(header, expected);
}
