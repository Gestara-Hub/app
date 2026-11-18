import type {
  ChargeStatus,
  DateISO,
  MessageLogStatus,
  MessageTemplate,
  MessageTrigger,
  MetaTemplateStatus,
} from "@gestarahub/contracts";
import { isManualTrigger } from "@/lib/whatsapp";

/** Nome curto de cada tipo de mensagem e onde o botao aparece no sistema. */
export const TRIGGER_META: Record<MessageTrigger, { label: string; where: string }> = {
  billing_before_due: { label: "Mensalidade a vencer", where: "Cobranças: menu da mensalidade a vencer" },
  billing_due_date: { label: "Vence hoje", where: "Cobranças: menu da mensalidade que vence hoje" },
  billing_after_due: { label: "Em atraso", where: "Cobranças: menu da mensalidade atrasada" },
  billing_critical: { label: "Atraso de 10 dias", where: "Cobranças: atraso de 10 dias ou mais" },
  welcome_student: { label: "Boas-vindas", where: "Ao cadastrar um aluno" },
  absence_alert: { label: "Sentimos sua falta", where: "Painel: Para fazer hoje, alunos com 3 faltas seguidas" },
  birthday_greeting: { label: "Aniversário", where: "Painel: Para fazer hoje e aniversariantes do mês" },
  charge_reminder: {
    label: "Lembrete de cobrança",
    where: "Cobranças: menu da avulsa, do curso ou do pacote",
  },
  package_ending: { label: "Pacote acabando", where: "Painel: Para fazer hoje, pacotes acabando" },
  payment_received: { label: "Pagamento recebido", where: "Mensagem para o aluno: até 7 dias após pagar" },
  level_up: { label: "Parabéns pelo avanço", where: "Mensagem para o aluno: até 14 dias após avançar" },
  trial_follow_up: { label: "Chamar de volta (experimental)", where: "Painel: Para fazer hoje, experimentais sem voltar" },
  event_reminder: { label: "Evento amanhã", where: "Painel: Lembretes, inscritos para avisar do evento de amanhã" },
  class_canceled: { label: "Aula cancelada", where: "Mensagem para o aluno: sempre" },
  schedule_change: { label: "Mudança de horário", where: "Mensagem para o aluno: sempre" },
  holiday_notice: { label: "Feriado ou recesso", where: "Mensagem para o aluno: sempre" },
  manual_broadcast: { label: "Mensagem avulsa", where: "Botão Nova mensagem" },
};

/**
 * Situacao da mensagem no Historico, cor por significado (30/10/2026): cinza =
 * assistido (o sistema so sabe que abriu o WhatsApp), ambar = esperando, azul
 * = a caminho (enviada, entregue), verde = lida (o fim esperado), vermelho =
 * falhou. O icone segue os tiques do WhatsApp (componente MessageStatusBadge).
 */
const SKY = "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
export const STATUS_META: Record<MessageLogStatus, { label: string; className: string }> = {
  opened: { label: "Aberto no WhatsApp", className: "border-border bg-muted text-muted-foreground" },
  queued: { label: "Na fila", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  sent: { label: "Enviada", className: SKY },
  delivered: { label: "Entregue", className: SKY },
  read: { label: "Lida", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

/** Ordem dos modelos na tela: mensalidade, depois as outras cobrancas. */
export const TRIGGER_ORDER: MessageTrigger[] = [
  "billing_before_due",
  "billing_due_date",
  "billing_after_due",
  "billing_critical",
  "charge_reminder",
  "payment_received",
  "trial_follow_up",
  "event_reminder",
  "welcome_student",
  "absence_alert",
  "package_ending",
  "birthday_greeting",
  "level_up",
  "class_canceled",
  "schedule_change",
  "holiday_notice",
  "manual_broadcast",
];

/** Quando o envio automatico sai (so no WhatsApp oficial). */
export function automationTiming(template: MessageTemplate): string {
  const { trigger, daysOffset } = template;
  if (trigger === "welcome_student") return "Na hora do cadastro";
  if (trigger === "birthday_greeting") return "No dia do aniversário";
  if (trigger === "absence_alert") return `Depois de ${daysOffset} faltas seguidas`;
  if (trigger === "package_ending") {
    return `Na última aula e ${daysOffset} ${daysOffset === 1 ? "dia" : "dias"} antes de vencer`;
  }
  if (daysOffset < 0) return `${Math.abs(daysOffset)} ${Math.abs(daysOffset) === 1 ? "dia" : "dias"} antes do vencimento`;
  if (daysOffset === 0) return "No dia do vencimento";
  return `${daysOffset} ${daysOffset === 1 ? "dia" : "dias"} depois do vencimento`;
}

/** Subtitulo exibido no cartao e no painel do modelo, diferenciando escopo e envio manual. */
export function templateSubtitle(template: MessageTemplate, official: boolean): string {
  const where = TRIGGER_META[template.trigger]?.where ?? "";
  if (isManualTrigger(template.trigger)) {
    return official ? `Envio manual · ${where}` : where;
  }
  if (!official) return where;
  const timing = automationTiming(template);
  if (template.trigger === "billing_before_due") return `Mensalidades · ${timing}`;
  if (template.trigger === "charge_reminder") return `Avulsa, curso, pacote e evento · ${timing}`;
  return timing;
}

/** Valores de exemplo para a previa dos modelos. */
export function sampleValues(orgName?: string, withPaymentLink = false): Record<string, string | undefined> {
  return {
    aluno: "Ana Souza",
    empresa: orgName || "seu espaço",
    valor: "R$ 150,00",
    vencimento: "10/11",
    link_pagamento: withPaymentLink ? "https://pagar.gestarahub.com/c/abc123" : undefined,
    // Serve a qualquer area do espaco (achado 8): nada de "curso Confeitaria" numa academia de lutas.
    referencia: "mensalidade de novembro",
    pacote: "10 aulas",
    restante: "resta 1 aula",
    nivel: "Faixa Azul",
  };
}

/**
 * Previa do modelo com os valores de exemplo. O aviso de mudanca de horario
 * termina esperando o horario novo (a tela de avisos o completa na hora de
 * enviar); na previa entra um horario de exemplo.
 */
export function templatePreview(
  trigger: MessageTrigger,
  filled: string,
): string {
  return trigger === "schedule_change" ? `${filled} Terças e quintas, 19h às 20h.` : filled;
}

/** Qual lembrete de cobranca serve para a mensalidade, pela situacao dela hoje. */
export function billingReminderTrigger(
  charge: { status: ChargeStatus; dueDate: DateISO },
  today: DateISO,
): MessageTrigger {
  if (charge.status === "overdue") {
    const days = Math.floor(
      (new Date(`${today}T12:00:00`).getTime() - new Date(`${charge.dueDate}T12:00:00`).getTime()) / 86_400_000,
    );
    return days >= 10 ? "billing_critical" : "billing_after_due";
  }
  return charge.dueDate === today ? "billing_due_date" : "billing_before_due";
}

export interface MetaStatusNotice {
  /** Curto, na linha do prazo: "Em análise no WhatsApp". */
  text: string;
  /** O que acontece ou o que fazer. */
  hint: string;
  tone: "warning" | "danger";
  /** Pede uma acao no texto (recusado): a linha leva a edicao. */
  needsEdit: boolean;
}

/**
 * Situacao do modelo no WhatsApp oficial, so quando pede atencao: aprovado e
 * o normal e nao aparece (menos poluicao na tela de Comunicacao). Na tela,
 * "WhatsApp" em vez de "Meta": o dono conhece o WhatsApp.
 */
export function metaStatusNotice(status: MetaTemplateStatus | undefined): MetaStatusNotice | null {
  switch (status) {
    case "PENDING":
      return {
        text: "Em análise no WhatsApp",
        hint: "Leva alguns minutos. A mensagem sai sozinha quando aprovar.",
        tone: "warning",
        needsEdit: false,
      };
    case "REJECTED":
      return {
        text: "Recusado pelo WhatsApp: ajuste o texto",
        hint: "O WhatsApp não aprovou este texto. Edite e salve para ele analisar de novo.",
        tone: "danger",
        needsEdit: true,
      };
    case "PAUSED":
      return {
        text: "Pausado pelo WhatsApp: revise o texto",
        hint: "Muitos alunos bloquearam ou denunciaram esta mensagem. Revise o texto.",
        tone: "warning",
        needsEdit: true,
      };
    case "DISABLED":
      return {
        text: "Desativado pelo WhatsApp: revise o texto",
        hint: "O WhatsApp desativou este texto depois de muitas denúncias. Edite e salve para ele analisar de novo.",
        tone: "danger",
        needsEdit: true,
      };
    default:
      return null;
  }
}
