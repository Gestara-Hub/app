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
  "trial_follow_up",
  "event_reminder",
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

/** Compartilhar um texto pelo WhatsApp, escolhendo o contato no aparelho (sem numero). */
export function whatsappShareLink(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
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

/**
 * Variaveis do modelo aprovado da Meta, na ordem em que aparecem no texto
 * (`{{1}}`, `{{2}}`...), como `convertGestaraVariablesToMetaPositional`. A Meta
 * recusa variavel vazia, com quebra de linha, tabulacao ou mais de 4 espacos
 * seguidos: sem valor, devolve null (a mensagem nao cabe no modelo).
 */
export function metaTemplateParams(
  content: string,
  values: Record<string, string | undefined>,
): string[] | null {
  const params: string[] = [];
  for (const match of content.matchAll(/\{(\w+)\}/g)) {
    const raw = values[match[1]!];
    const value = (raw ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
    if (!value) return null;
    params.push(value);
  }
  return params;
}

/**
 * Texto sem as frases das variaveis que o espaco nunca preenche (ex.: link
 * do pagamento sem pagamento online). E o texto do modelo na Meta: la toda
 * variavel e obrigatoria, entao a frase opcional fica de fora. Mesma regra de
 * corte de `fillMessage` (frase por frase, linha por linha).
 */
export function dropSentencesWith(content: string, keys: readonly string[]): string {
  if (keys.length === 0) return content.trim();
  const re = new RegExp(`\\{(?:${keys.join("|")})\\}`);
  if (!re.test(content)) return content.trim();
  return content
    .split("\n")
    .flatMap((line) => {
      if (!re.test(line)) return [line];
      const kept = line
        .split(/(?<=[.!?…])\s+/)
        .filter((sentence) => !re.test(sentence))
        .join(" ")
        .trim();
      return kept ? [kept] : [];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
