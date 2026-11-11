import type { ClassesBusinessSegment, Id, MessageTemplate } from "@gestarahub/contracts";
import { timestamps } from "./financialDefaults";

/**
 * Padroes de produto de todo espaco novo (doc 15, fatia 4): categorias
 * financeiras (as de sistema tem id deterministico, o mesmo do gatilho
 * `seed_organization_financial_categories` do banco), conexao assistida do
 * WhatsApp e modelos de mensagem por area. Nao sao dados de demonstracao.
 */

/**
 * Modelos de mensagem de um espaco novo, no tom da area.
 */

/** Trechos que mudam conforme a area: lutas fala em treino e tatame; o resto, em aula. */
function messageTone(segment: ClassesBusinessSegment | undefined) {
  if (!segment || segment === "martial_arts") {
    return {
      closing: " Bons treinos! 🥋",
      welcomeTail: "acompanhar seus treinos, horários e graduações. Nos vemos no tatame!",
      absenceLine: "nos últimos treinos da {empresa}. Seu lugar no tatame está guardado!",
      renewQuestion: "Quer renovar e seguir treinando?",
      canceledLine: "O treino de hoje na {empresa} foi cancelado. Desculpe o transtorno, nos vemos no próximo treino!",
      noClass: "não teremos treino",
    };
  }
  return {
    closing: " Boas aulas!",
    welcomeTail: "acompanhar suas aulas, horários e evolução. Até a primeira aula!",
    absenceLine: "nas últimas aulas da {empresa}. Seu lugar na turma está guardado!",
    renewQuestion: "Quer renovar e seguir com as aulas?",
    canceledLine: "A aula de hoje na {empresa} foi cancelada. Desculpe o transtorno, nos vemos na próxima aula!",
    noClass: "não teremos aula",
  };
}

export function defaultMessageTemplates(
  organizationId: Id,
  segment?: ClassesBusinessSegment,
): MessageTemplate[] {
  const ts = timestamps();
  const tone = messageTone(segment);
  return [
    {
      id: `tmpl-${organizationId}-before-due`,
      organizationId,
      trigger: "billing_before_due",
      category: "billing",
      title: "Lembrete antes do vencimento",
      description: "Disparado 3 dias antes do vencimento da mensalidade",
      enabled: true,
      sendHour: "09:00",
      daysOffset: -3,
      content:
        `Olá, {aluno}! Passando para lembrar que sua mensalidade de {valor} na {empresa} vence em {vencimento}. Pague com facilidade pelo Pix Copia e Cola: {link_pagamento}.${tone.closing}`,
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-due-date`,
      organizationId,
      trigger: "billing_due_date",
      category: "billing",
      title: "Vencimento hoje",
      description: "Disparado no dia do vencimento da mensalidade",
      enabled: true,
      sendHour: "09:30",
      daysOffset: 0,
      content:
        "Olá, {aluno}! Sua mensalidade da {empresa} no valor de {valor} vence hoje ({vencimento}). Garanta sua vaga ativa acessando o link seguro de pagamento: {link_pagamento}. Obrigado!",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-after-due`,
      organizationId,
      trigger: "billing_after_due",
      category: "billing",
      title: "Atraso de 3 dias",
      description: "Disparado 3 dias após o vencimento não identificado",
      enabled: true,
      sendHour: "10:00",
      daysOffset: 3,
      content:
        "Oi, {aluno}! Notamos que a mensalidade de {valor} da {empresa} que venceu em {vencimento} ainda está em aberto. Para regularizar sem complicações, basta acessar: {link_pagamento}. Qualquer dúvida, estamos à disposição!",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-critical`,
      organizationId,
      trigger: "billing_critical",
      category: "billing",
      title: "Atraso de 10 dias",
      description: "Disparado 10 dias após o vencimento com aviso de bloqueio",
      enabled: false,
      sendHour: "11:00",
      daysOffset: 10,
      content:
        "Olá, {aluno}. A mensalidade de {valor} na {empresa}, vencida em {vencimento}, segue em aberto. Para não suspender as aulas, pague pelo link {link_pagamento} ou fale com a recepção. Obrigado!",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      // Avulsa, parcela de curso e compra de pacote (doc 20, fase D). A
      // mensalidade segue com os quatro lembretes acima.
      id: `tmpl-${organizationId}-charge-reminder`,
      organizationId,
      trigger: "charge_reminder",
      category: "billing",
      title: "Lembrete de cobrança",
      description: "Cobrança avulsa, parcela de curso ou compra de pacote",
      enabled: true,
      sendHour: "09:00",
      daysOffset: -3,
      content:
        `Olá, {aluno}! Lembrete da {referencia} de {valor} na {empresa}, com vencimento em {vencimento}. Pague pelo link: {link_pagamento}.${tone.closing}`,
      availableVariables: ["{aluno}", "{referencia}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-welcome`,
      organizationId,
      trigger: "welcome_student",
      category: "retention",
      title: "Boas-vindas",
      description: "Disparado automaticamente ao confirmar nova matrícula",
      enabled: true,
      sendHour: "08:00",
      daysOffset: 0,
      content:
        `Seja muito bem-vindo(a) à {empresa}, {aluno}! 🎉 Sua matrícula foi confirmada com sucesso. Acesse o nosso aplicativo do aluno pelo link {link_app} para ${tone.welcomeTail}`,
      availableVariables: ["{aluno}", "{empresa}", "{link_app}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-absence`,
      organizationId,
      trigger: "absence_alert",
      category: "retention",
      title: "Sentimos sua falta",
      description: "Para alunos com 3 faltas seguidas",
      enabled: true,
      sendHour: "14:00",
      daysOffset: 3,
      content:
        `Oi, {aluno}! Tudo bem? Sentimos muito a sua falta ${tone.absenceLine} Queremos te ver por aqui esta semana. Como podemos te ajudar a retomar sua rotina? 💪`,
      availableVariables: ["{aluno}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-package-ending`,
      organizationId,
      trigger: "package_ending",
      category: "retention",
      title: "Pacote acabando",
      description: "Na última aula, 7 dias antes de vencer ou logo depois",
      enabled: true,
      sendHour: "10:00",
      daysOffset: 7,
      content: `Oi, {aluno}! Sobre seu pacote {pacote} na {empresa}: {restante}. ${tone.renewQuestion}`,
      availableVariables: ["{aluno}", "{pacote}", "{restante}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-birthday`,
      organizationId,
      trigger: "birthday_greeting",
      category: "retention",
      title: "Aniversário",
      description: "Disparado no dia do aniversário do aluno cadastrado",
      enabled: true,
      sendHour: "08:30",
      daysOffset: 0,
      content:
        "Parabéns pelo seu dia, {aluno}! 🎂 Toda a equipe da {empresa} deseja muita saúde, conquistas e evolução. É uma honra ter você na nossa família! Aproveite seu dia especial.",
      availableVariables: ["{aluno}", "{empresa}"],
      ...ts,
    },
    // So envio manual (sem automatico): sugeridos na mensagem para o aluno.
    ...manualMessageTemplates(organizationId, tone, ts),
  ];
}

/** Modelos so de envio manual: desligados, sem horario nem prazo que valham. */
function manualMessageTemplates(
  organizationId: Id,
  tone: ReturnType<typeof messageTone>,
  ts: ReturnType<typeof timestamps>,
): MessageTemplate[] {
  const manual = (
    key: string,
    template: Pick<MessageTemplate, "trigger" | "category" | "title" | "description" | "content" | "availableVariables">,
  ): MessageTemplate => ({
    id: `tmpl-${organizationId}-${key}`,
    organizationId,
    enabled: false,
    sendHour: "09:00",
    daysOffset: 0,
    ...template,
    ...ts,
  });
  return [
    manual("trial-follow-up", {
      trigger: "trial_follow_up",
      category: "retention",
      title: "Chamar de volta (experimental)",
      description: "Para quem fez aula experimental e ainda não voltou",
      content: `Oi, {aluno}! Foi muito bom ter você na aula experimental. Que tal continuar com a gente? Me conta o que achou e te ajudo a escolher a turma e o plano.${tone.closing}`,
      availableVariables: ["{aluno}", "{empresa}"],
    }),
    manual("event-reminder", {
      trigger: "event_reminder",
      category: "administrative",
      title: "Evento amanhã",
      description: "Para os inscritos, na véspera do evento",
      content: "Oi, {aluno}! Amanhã tem {evento} na {empresa}, {dia} às {horario}. Te esperamos!",
      availableVariables: ["{aluno}", "{evento}", "{dia}", "{horario}", "{empresa}"],
    }),
    manual("payment-received", {
      trigger: "payment_received",
      category: "billing",
      title: "Pagamento recebido",
      description: "Agradecimento depois de um pagamento",
      content: `Oi, {aluno}! Recebemos o pagamento de {valor} da {referencia}. Obrigado!${tone.closing}`,
      availableVariables: ["{aluno}", "{valor}", "{referencia}", "{empresa}"],
    }),
    manual("level-up", {
      trigger: "level_up",
      category: "retention",
      title: "Parabéns pelo avanço",
      description: "Depois de uma graduação ou troca de nível",
      content: `Parabéns, {aluno}! 🎉 Nova conquista na {empresa}: {nivel}. É resultado da sua dedicação.${tone.closing}`,
      availableVariables: ["{aluno}", "{nivel}", "{empresa}"],
    }),
    manual("class-canceled", {
      trigger: "class_canceled",
      category: "administrative",
      title: "Aula cancelada",
      description: "Aviso de aula cancelada",
      content: `Oi, {aluno}! ${tone.canceledLine}`,
      availableVariables: ["{aluno}", "{empresa}"],
    }),
    manual("schedule-change", {
      trigger: "schedule_change",
      category: "administrative",
      title: "Mudança de horário",
      description: "Aviso de novo horário da turma",
      content: "Oi, {aluno}! Aviso de {empresa}: sua turma vai mudar de horário. Novo horário:",
      availableVariables: ["{aluno}", "{empresa}"],
    }),
    manual("holiday-notice", {
      trigger: "holiday_notice",
      category: "administrative",
      title: "Feriado ou recesso",
      description: "Aviso de pausa nas aulas",
      content: `Oi, {aluno}! Aviso de {empresa}: no feriado ${tone.noClass}. Bom descanso e até a volta!`,
      availableVariables: ["{aluno}", "{empresa}"],
    }),
  ];
}
