import type { MessageTrigger } from "@gestarahub/contracts";
import { whatsappDigits } from "@gestarahub/core/phone";

/**
 * WhatsApp do proprio espaco: numero no formato do `wa.me`, link com o texto
 * pronto (envio assistido) e preenchimento das variaveis dos modelos.
 */

/** Modelos so de envio manual: sem envio automatico, nem no WhatsApp oficial. */
/** Mensagem para o aluno: ate 1000 caracteres (emoji conta 1, `charCount`). */
export const MESSAGE_MAX_LENGTH = 1000;
/** Modelo de mensagem: 900, folga para os nomes trocados pelas variaveis. */
export const TEMPLATE_MAX_LENGTH = 900;

export const MANUAL_MESSAGE_TRIGGERS: readonly MessageTrigger[] = [
  "payment_received",
  "level_up",
  "class_canceled",
  "schedule_change",
  "holiday_notice",
];

export function isManualTrigger(trigger: MessageTrigger): boolean {
  return MANUAL_MESSAGE_TRIGGERS.includes(trigger);
}

/**
 * "+5511999998888" ou o antigo "(11) 99999-8888" -> "5511999998888" (o wa.me
 * pede DDI). Numero de outro pais vai com o DDI dele. `null` se nao for
 * telefone (core/phone).
 */
export function whatsappNumber(phone?: string | null): string | null {
  return whatsappDigits(phone);
}

/**
 * Link que abre o WhatsApp do aparelho com a conversa e o texto prontos.
 * Usa `api.whatsapp.com/send`, nao o atalho `wa.me`: o redirecionamento do
 * `wa.me` estraga emojis (chegam como "" no WhatsApp).
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

/**
 * `{aluno}` e `{empresa}` do texto escrito na mensagem avulsa, para cada aluno
 * (so essas duas; qualquer outra chave fica como foi digitada).
 */
export function personalizeMessage(content: string, studentName: string, organizationName?: string): string {
  const named = content.replaceAll("{aluno}", studentName);
  return (organizationName ? named.replaceAll("{empresa}", organizationName) : named).trim();
}
