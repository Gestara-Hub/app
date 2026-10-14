import type {
  ChargeStatus,
  DateISO,
  MessageLogStatus,
  MessageTemplate,
  MessageTrigger,
} from "@gestarahub/contracts";

/** Nome curto de cada tipo de mensagem e onde o botao aparece no sistema. */
export const TRIGGER_META: Record<MessageTrigger, { label: string; where: string }> = {
  billing_before_due: { label: "Mensalidade a vencer", where: "Cobranças: menu da mensalidade a vencer" },
  billing_due_date: { label: "Vence hoje", where: "Cobranças: menu da mensalidade que vence hoje" },
  billing_after_due: { label: "Em atraso", where: "Cobranças: menu da mensalidade atrasada" },
  billing_critical: { label: "Atraso de 10 dias", where: "Cobranças: atraso de 10 dias ou mais" },
  welcome_student: { label: "Boas-vindas", where: "Ao cadastrar um aluno" },
  absence_alert: { label: "Sentimos sua falta", where: "Dashboard: Para fazer hoje, alunos com 3 faltas seguidas" },
  birthday_greeting: { label: "Aniversário", where: "Dashboard: Para fazer hoje e aniversariantes do mês" },
  manual_broadcast: { label: "Mensagem avulsa", where: "Botão Nova mensagem" },
};

export const STATUS_META: Record<MessageLogStatus, { label: string; className: string }> = {
  opened: { label: "Aberto no WhatsApp", className: "border-border bg-muted text-muted-foreground" },
  queued: { label: "Na fila", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  sent: { label: "Enviada", className: "border-border bg-muted text-foreground" },
  delivered: {
    label: "Entregue",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  read: { label: "Lida", className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

/** Quando o envio automatico sai (so no WhatsApp oficial). */
export function automationTiming(template: MessageTemplate): string {
  const { trigger, daysOffset } = template;
  if (trigger === "welcome_student") return "Na hora do cadastro";
  if (trigger === "birthday_greeting") return "No dia do aniversário";
  if (trigger === "absence_alert") return `Depois de ${daysOffset} faltas seguidas`;
  if (daysOffset < 0) return `${Math.abs(daysOffset)} ${Math.abs(daysOffset) === 1 ? "dia" : "dias"} antes do vencimento`;
  if (daysOffset === 0) return "No dia do vencimento";
  return `${daysOffset} ${daysOffset === 1 ? "dia" : "dias"} depois do vencimento`;
}

/** Valores de exemplo para a previa dos modelos. */
export function sampleValues(orgName?: string, withPaymentLink = false): Record<string, string | undefined> {
  return {
    aluno: "Ana Souza",
    empresa: orgName || "seu espaço",
    valor: "R$ 150,00",
    vencimento: "10/11",
    link_pagamento: withPaymentLink ? "https://pagar.gestarahub.com/c/abc123" : undefined,
  };
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
