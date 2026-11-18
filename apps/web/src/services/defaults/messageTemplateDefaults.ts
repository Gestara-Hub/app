import type { ClassesBusinessSegment, Id, MessageTemplate } from "@gestarahub/contracts";
import { masterContent, masterTemplateFor } from "@/lib/whatsapp/master-templates";
import { timestamps } from "./financialDefaults";

/**
 * Padroes de produto de todo espaco novo (doc 15, fatia 4): categorias
 * financeiras (as de sistema tem id deterministico, o mesmo do gatilho
 * `seed_organization_financial_categories` do banco), conexao assistida do
 * WhatsApp e modelos de mensagem por area. Nao sao dados de demonstracao.
 */

/**
 * Modelos de mensagem de um espaco novo.
 */

/**
 * Texto e variaveis de cada aviso: os do modelo mestre (doc technical/07 §1.7),
 * iguais para todas as areas desde 18/11/2026 (antes, lutas falava em treino e
 * tatame). A area fica no parametro so por compatibilidade.
 */
type WithoutText = Omit<MessageTemplate, "content" | "availableVariables">;

function withMasterText(templates: WithoutText[]): MessageTemplate[] {
  return templates.map((template) => {
    const master = masterTemplateFor(template.trigger)!;
    return { ...template, content: masterContent(master), availableVariables: [...master.variables] };
  });
}

export function defaultMessageTemplates(
  organizationId: Id,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a area nao muda mais o texto (18/11/2026)
  segment?: ClassesBusinessSegment,
): MessageTemplate[] {
  const ts = timestamps();
  return withMasterText([
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
      ...ts,
    },
    // So envio manual (sem automatico): sugeridos na mensagem para o aluno.
    ...manualMessageTemplates(organizationId, ts),
  ]);
}

/** Modelos so de envio manual: desligados, sem horario nem prazo que valham. */
function manualMessageTemplates(organizationId: Id, ts: ReturnType<typeof timestamps>): WithoutText[] {
  const manual = (
    key: string,
    template: Pick<MessageTemplate, "trigger" | "category" | "title" | "description">,
  ): WithoutText => ({
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
    }),
    manual("event-reminder", {
      trigger: "event_reminder",
      category: "administrative",
      title: "Evento amanhã",
      description: "Para os inscritos, na véspera do evento",
    }),
    manual("payment-received", {
      trigger: "payment_received",
      category: "billing",
      title: "Pagamento recebido",
      description: "Agradecimento depois de um pagamento",
    }),
    manual("level-up", {
      trigger: "level_up",
      category: "retention",
      title: "Parabéns pelo avanço",
      description: "Depois de uma graduação ou troca de nível",
    }),
    manual("class-canceled", {
      trigger: "class_canceled",
      category: "administrative",
      title: "Aula cancelada",
      description: "Aviso de aula cancelada",
    }),
    manual("schedule-change", {
      trigger: "schedule_change",
      category: "administrative",
      title: "Mudança de horário",
      description: "Aviso de novo horário da turma",
    }),
    manual("holiday-notice", {
      trigger: "holiday_notice",
      category: "administrative",
      title: "Feriado ou recesso",
      description: "Aviso de pausa nas aulas",
    }),
  ];
}
