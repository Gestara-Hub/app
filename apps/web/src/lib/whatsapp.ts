/**
 * WhatsApp do proprio espaco: numero no formato do `wa.me`, link com o texto
 * pronto (envio assistido) e preenchimento das variaveis dos modelos.
 */

/**
 * "(11) 99999-8888" -> "5511999998888" (o wa.me pede DDI). O 0 de ligacao
 * interurbana ("011 ...") e o 00 internacional saem. `null` se nao for telefone.
 */
export function whatsappNumber(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 10) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

/**
 * Link que abre o WhatsApp do aparelho com a conversa e o texto prontos.
 * Usa `api.whatsapp.com/send`, nao o atalho `wa.me`: o redirecionamento do
 * `wa.me` estraga emojis (chegam como "�" no WhatsApp).
 */
export function whatsappLink(phone: string, text: string): string {
  const number = whatsappNumber(phone) ?? phone.replace(/\D/g, "");
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`;
}

const VARIABLE_RE = /\{(\w+)\}/g;
const HAS_VARIABLE_RE = /\{\w+\}/;

/**
 * Troca as variaveis do modelo ({aluno}, {valor}...) pelos valores. Frase que
 * ficou com variavel sem valor sai inteira (ex.: o link de pagamento quando o
 * espaco nao cobra online), para a mensagem nao chegar com "{link_pagamento}".
 * Fim de linha tambem fecha frase, e as quebras de linha do modelo ficam.
 */
export function fillMessage(content: string, values: Record<string, string | undefined>): string {
  const filled = content.replace(VARIABLE_RE, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === "" ? match : value;
  });
  if (!HAS_VARIABLE_RE.test(filled)) return filled.trim();
  return filled
    .split("\n")
    .flatMap((line) => {
      if (!HAS_VARIABLE_RE.test(line)) return [line];
      const kept = line
        .split(/(?<=[.!?…])\s+/)
        .filter((sentence) => !HAS_VARIABLE_RE.test(sentence))
        .join(" ")
        .trim();
      return kept ? [kept] : [];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
