import type { MessageTrigger } from "@gestarahub/contracts";

/**
 * Modelos mestres do WhatsApp (18/11/2026, doc technical/07 §1.7): um texto por
 * aviso, igual para todas as areas e todos os espacos. Cobranca usa modelos da
 * biblioteca da Meta (utilidade, aprovados na hora, texto fixo da Meta); o resto
 * usa texto proprio. Na Meta, cada modelo tem o nome `<aviso>_v2` (os nomes sem
 * versao sao os antigos, apagados na sincronizacao).
 *
 * `body` e o texto na Meta, com {{1}}, {{2}}...; `params` diz o que entra em
 * cada posicao, com as variaveis do GestaraHub ({aluno}, {valor}...) ou texto
 * fixo. O texto do espaco (previa, envio assistido e Historico) e o `body` com
 * os `params` no lugar (`masterContent`).
 */

export type MasterTemplateCategory = "UTILITY" | "MARKETING";

/** Tipo de cada variavel na Meta: a biblioteca confere valor e data na hora do envio. */
export type MasterParamType = "TEXT" | "AMOUNT" | "DATE";

export interface MasterTemplate {
  trigger: MessageTrigger;
  /** Nome na conta do WhatsApp do espaco. */
  metaName: string;
  category: MasterTemplateCategory;
  /** Nome do modelo na biblioteca da Meta (so os de cobranca). */
  library?: string;
  /** Texto na Meta, com {{n}}. */
  body: string;
  /** O que entra em cada {{n}}, na ordem. */
  params: string[];
  /** Tipo de cada {{n}} (so a biblioteca confere; os proprios sao todos TEXT). */
  paramTypes?: MasterParamType[];
  /** Botao "Pagar agora" com o endereco da pagina de pagamento do aluno (biblioteca). */
  paymentButton?: boolean;
  /** Variaveis que a tela oferece (a previa e o envio assistido). */
  variables: string[];
}

/** Versao dos nomes na Meta: mudar o texto de um modelo pede um nome novo. */
const VERSION = "v2";

/** Linha do envio assistido nos avisos com botao: no WhatsApp do aparelho nao ha botao. */
const ASSISTED_LINK_SENTENCE = "Pague pelo link: {link_pagamento}";
const ASSISTED_LINK_LINE = `\n\n${ASSISTED_LINK_SENTENCE}`;
/** Frase do `payment_overdue_2` que fala do botao. */
const BUTTON_SENTENCE = "Use o botão abaixo para concluir o pagamento através do nosso site.";

/** Modelo proprio: texto com as variaveis do GestaraHub; vira {{n}} na ordem em que aparecem. */
function own(
  trigger: MessageTrigger,
  category: MasterTemplateCategory,
  content: string,
): MasterTemplate {
  const params: string[] = [];
  const body = content.replace(/\{(\w+)\}/g, (match) => {
    params.push(match);
    return `{{${params.length}}}`;
  });
  return { trigger, metaName: `${trigger}_${VERSION}`, category, body, params, variables: [...new Set(params)] };
}

/** Modelo da biblioteca da Meta: texto copiado da biblioteca (pt_BR), palavra por palavra. */
function library(
  trigger: MessageTrigger,
  name: string,
  body: string,
  params: string[],
  paramTypes: MasterParamType[],
): MasterTemplate {
  const variables = [...new Set(params.flatMap((p) => p.match(/\{\w+\}/g) ?? [])), "{link_pagamento}"];
  return {
    trigger,
    metaName: `${trigger}_${VERSION}`,
    category: "UTILITY",
    library: name,
    body,
    params,
    paramTypes,
    paymentButton: true,
    variables,
  };
}

/** `payment_reminder_3` (biblioteca, pt_BR): conta, valor, vencimento e o que evitar. */
const PAYMENT_REMINDER_3 =
  "Lembrete de pagamento:\n\nConta: {{1}}\nValor a pagar: {{2}}\nData de vencimento: {{3}}\n\nPague agora para evitar {{4}}.\n\nSe você já pagou, ignore esta mensagem.";
const PAYMENT_REMINDER_3_TYPES: MasterParamType[] = ["TEXT", "AMOUNT", "DATE", "TEXT"];

/** `payment_overdue_2` (biblioteca, pt_BR): aluno, conta, valor e vencimento. */
const PAYMENT_OVERDUE_2 =
  "Olá, {{1}}, você tem um pagamento atrasado:\n\nConta: {{2}}\nValor devido: {{3}}\nData prevista: {{4}}\n\nUse o botão abaixo para concluir o pagamento através do nosso site.\nPor favor ignore esta mensagem se você já pagou.";
const PAYMENT_OVERDUE_2_TYPES: MasterParamType[] = ["TEXT", "TEXT", "AMOUNT", "DATE"];

const LIST: MasterTemplate[] = [
  // Cobranca: biblioteca da Meta (utilidade, sem analise).
  library(
    "billing_before_due",
    "payment_reminder_3",
    PAYMENT_REMINDER_3,
    ["Mensalidade na {empresa}", "{valor}", "{vencimento}", "pendências"],
    PAYMENT_REMINDER_3_TYPES,
  ),
  library(
    "billing_due_date",
    "payment_reminder_3",
    PAYMENT_REMINDER_3,
    ["Mensalidade na {empresa}", "{valor}", "{vencimento}", "pendências"],
    PAYMENT_REMINDER_3_TYPES,
  ),
  library(
    "charge_reminder",
    "payment_reminder_3",
    PAYMENT_REMINDER_3,
    ["{referencia} na {empresa}", "{valor}", "{vencimento}", "pendências"],
    PAYMENT_REMINDER_3_TYPES,
  ),
  library(
    "billing_after_due",
    "payment_overdue_2",
    PAYMENT_OVERDUE_2,
    ["{aluno}", "Mensalidade na {empresa}", "{valor}", "{vencimento}"],
    PAYMENT_OVERDUE_2_TYPES,
  ),
  library(
    "billing_critical",
    "payment_overdue_2",
    PAYMENT_OVERDUE_2,
    ["{aluno}", "Mensalidade na {empresa}", "{valor}", "{vencimento}"],
    PAYMENT_OVERDUE_2_TYPES,
  ),

  // Avisos: texto proprio, so informam (utilidade).
  own(
    "payment_received",
    "UTILITY",
    "Oi, {aluno}. Confirmamos o recebimento do pagamento de {valor} referente a {referencia}. Este aviso é a sua confirmação.",
  ),
  own(
    "event_reminder",
    "UTILITY",
    "Oi, {aluno}! Passando para lembrar que amanhã tem {evento} na {empresa}, {dia} às {horario}. Chegue alguns minutos antes para começarmos no horário. Te esperamos!",
  ),
  own(
    "class_canceled",
    "UTILITY",
    "Oi, {aluno}. Aviso da {empresa}: a aula de hoje foi cancelada. Desculpe o transtorno, nos vemos na próxima aula.",
  ),
  own(
    "schedule_change",
    "UTILITY",
    "Oi, {aluno}. Aviso da {empresa}: o horário da sua turma mudou. Novo horário: {horario}. Responda esta mensagem se tiver alguma dúvida.",
  ),
  own(
    "holiday_notice",
    "UTILITY",
    "Oi, {aluno}. Aviso da {empresa}: no feriado não teremos aula. Bom descanso e até a volta!",
  ),

  // Relacionamento: texto proprio, assumido como marketing.
  own(
    "welcome_student",
    "MARKETING",
    "Seja bem-vindo(a) à {empresa}, {aluno}! 🎉 Sua matrícula foi confirmada. Qualquer dúvida sobre horários e aulas, é só responder esta mensagem.",
  ),
  own(
    "birthday_greeting",
    "MARKETING",
    "Parabéns pelo seu dia, {aluno}! 🎂 Toda a equipe da {empresa} deseja muita saúde e conquistas. Aproveite o seu dia!",
  ),
  own(
    "absence_alert",
    "MARKETING",
    "Oi, {aluno}! Sentimos sua falta nas últimas aulas da {empresa}. Seu lugar continua guardado. Como podemos te ajudar a voltar à rotina?",
  ),
  own(
    "package_ending",
    "MARKETING",
    "Oi, {aluno}! Passando para avisar sobre o seu pacote {pacote} na {empresa}: {restante}. Se quiser renovar e seguir com as aulas, é só responder esta mensagem.",
  ),
  own(
    "level_up",
    "MARKETING",
    "Parabéns, {aluno}! 🎉 Nova conquista na {empresa}: {nivel}. É resultado da sua dedicação. Continue assim!",
  ),
  own(
    "trial_follow_up",
    "MARKETING",
    "Oi, {aluno}! Foi muito bom ter você na aula experimental da {empresa}. Quer continuar com a gente? Responda esta mensagem que te ajudamos a escolher a turma e o plano.",
  ),
];

export const MASTER_TEMPLATES: Partial<Record<MessageTrigger, MasterTemplate>> = Object.fromEntries(
  LIST.map((t) => [t.trigger, t]),
);

export function masterTemplateFor(trigger: MessageTrigger | undefined): MasterTemplate | undefined {
  return trigger ? MASTER_TEMPLATES[trigger] : undefined;
}

/** Nomes antigos na Meta (sem versao, ate 17/11/2026): a sincronizacao apaga. */
export const LEGACY_META_NAMES: readonly string[] = LIST.map((t) => t.trigger);

/**
 * Texto do espaco: o `body` com os `params` no lugar ({aluno}, {valor}...). Nos
 * avisos com botao, uma linha com o link para o envio assistido (o WhatsApp do
 * aparelho nao tem botao; sem link, `fillMessage` tira a frase).
 */
export function masterContent(template: MasterTemplate): string {
  const text = template.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => template.params[Number(n) - 1] ?? "");
  if (!template.paymentButton) return text;
  // A frase do botao nao vale no envio assistido: vira o link (o texto do
  // espaco nao vai a Meta; la vao so os valores de cada {{n}}).
  if (text.includes(BUTTON_SENTENCE)) return text.replace(BUTTON_SENTENCE, ASSISTED_LINK_SENTENCE);
  return `${text}${ASSISTED_LINK_LINE}`;
}

/** Valor de cada {{n}} para o envio; null se falta algum (a Meta recusa variavel vazia). */
export function masterParams(template: MasterTemplate, values: Record<string, string | undefined>): string[] | null {
  const params: string[] = [];
  for (const param of template.params) {
    let missing = false;
    const filled = param.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = values[key];
      if (value === undefined || value.trim() === "") missing = true;
      return value ?? "";
    });
    // Sem quebra de linha nem espaco duro: a Meta recusa e o tipo valor nao aceita.
    const clean = filled.replace(/[\n\t]+/g, " ").replace(/ /g, " ").replace(/ {2,}/g, " ").trim();
    if (missing || !clean) return null;
    params.push(clean);
  }
  return params;
}

/**
 * Final do endereco do botao "Pagar agora": o que vem depois de `/p/` na pagina
 * de pagamento do aluno (`/p/<codigo>` ou `/p/c/<cobranca>`). Link de fora (sem
 * `/p/`): sem botao.
 */
export function paymentButtonSuffix(link: string | undefined): string | null {
  if (!link) return null;
  const at = link.indexOf("/p/");
  if (at < 0) return null;
  const suffix = link.slice(at + 3).trim();
  return suffix || null;
}

/**
 * Inicio do endereco do botao na Meta (fixo ao criar o modelo). Endereco local
 * (localhost) nao vale para a Meta: usa o do site.
 */
export function paymentButtonBase(appUrl: string | undefined): string {
  const base = (appUrl ?? "").replace(/\/+$/, "");
  if (/^https:\/\//.test(base) && !/localhost|127\.0\.0\.1|\.local\b/.test(base)) return `${base}/p/`;
  return "https://gestarahub.com.br/p/";
}
