import {
  type ApiErrorField,
  type MessageCategory,
  type MessageLog,
  type MessageTemplate,
  type MessageTrigger,
  type SendMessagePayload,
  type WhatsAppConnection,
  type WhatsAppConnectionView,
  tierWhatsAppQuota,
} from "@gestarahub/contracts";
import { format } from "date-fns";
import { isBirthdayToday } from "@/lib/birthdays";
import { MESSAGE_MAX_LENGTH, fillMessage, isManualTrigger, whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import { newId, nowIso, persistLocal, validationError } from "@/services/world/ops";
import { defaultMessageTemplates, defaultWhatsAppConnection } from "@/services/defaults";
import { chargeInvoiceUrl, paymentPageUrl } from "@/lib/payment-page";
import { store } from "@/services/world/store";
import { tenantHasFeature } from "../subscription/subscriptionService";
import { dateInSpace } from "@gestarahub/core/date";
import { whatsappConsentGranted } from "../clients/clientConsentRules";

/**
 * Comunicacao pelo WhatsApp do proprio espaco (docs/product/13, secao 5):
 * envio assistido no gratis (o aparelho abre o WhatsApp com o texto; aqui so
 * registramos "Aberto no WhatsApp") e envio automatico pela API oficial no Pro.
 */

/**
 * Apoio da comunicacao: conexao, modelos e historico do espaco, categoria do gatilho, validacao e parabens do dia.
 */

export function ensureConnection(): WhatsAppConnection {
  // Sem assinatura = Gratis (sem envio automatico, franquia 0).
  const tier = store.organization.subscription?.tier ?? "free";
  if (!store.whatsAppConnection) {
    store.whatsAppConnection = defaultWhatsAppConnection(store.organization.id, tier);
  } else {
    // Reconcilia com a cota oficial do tier caso esteja com o default legado de 1000 no Pro
    const expectedQuota = tierWhatsAppQuota(tier);
    if (tier === "pro" && store.whatsAppConnection.monthlyQuota.included === 1000) {
      store.whatsAppConnection.monthlyQuota.included = expectedQuota;
    }
  }
  return store.whatsAppConnection;
}

/**
 * O envio automatico pode sair? Ainda nao ha credenciais por espaco (doc
 * technical/07 §1.1): tudo sairia do numero da plataforma. Decisao do usuario
 * (30/10/2026): em producao fica bloqueado ate o numero de cada espaco. Fora
 * de producao segue, com o numero de testes da Meta (que so alcanca os numeros
 * cadastrados como teste); o servidor do e2e tambem.
 */
export function officialSendingAvailable(): boolean {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.E2E_NOW);
}

export function connectionView(): WhatsAppConnectionView {
  const connection = ensureConnection();
  const canUseOfficial = tenantHasFeature("messaging");
  const officialAvailable = officialSendingAvailable();
  const isQuotaExhausted =
    connection.monthlyQuota.included > 0 &&
    connection.monthlyQuota.used >= connection.monthlyQuota.included;

  return {
    ...connection,
    canUseOfficial,
    isQuotaExhausted,
    officialAvailable,
    mode:
      canUseOfficial && officialAvailable && connection.officialStatus === "connected" && !isQuotaExhausted
        ? "official"
        : "assisted",
  };
}

export function ensureTemplates(): MessageTemplate[] {
  const defaults = defaultMessageTemplates(store.organization.id, store.organization.classSegment);
  if (!store.messageTemplates || store.messageTemplates.length === 0) {
    store.messageTemplates = defaults;
    return store.messageTemplates;
  }
  // Modelo novo da plataforma (ex.: chamar de volta o experimental, 09/11/2026):
  // o espaco antigo ganha o padrao sem perder o que ja tem.
  for (const template of defaults) {
    if (!store.messageTemplates.some((t) => t.trigger === template.trigger)) store.messageTemplates.push(template);
  }
  return store.messageTemplates;
}

export function ensureLogs(): MessageLog[] {
  if (!store.messageLogs) store.messageLogs = [];
  return store.messageLogs;
}

export const TRIGGER_CATEGORY: Record<MessageTrigger, MessageCategory> = {
  billing_before_due: "billing",
  billing_due_date: "billing",
  billing_after_due: "billing",
  billing_critical: "billing",
  charge_reminder: "billing",
  payment_received: "billing",
  welcome_student: "retention",
  absence_alert: "retention",
  birthday_greeting: "retention",
  package_ending: "retention",
  level_up: "retention",
  trial_follow_up: "retention",
  event_reminder: "administrative",
  class_canceled: "administrative",
  schedule_change: "administrative",
  holiday_notice: "administrative",
  manual_broadcast: "administrative",
};

export function categoryOf(trigger?: MessageTrigger): MessageCategory {
  return trigger ? TRIGGER_CATEGORY[trigger] : "administrative";
}

/** Lembretes de cobranca: os que contam no valor recuperado. */
export function isBillingReminder(trigger: MessageTrigger): boolean {
  return trigger.startsWith("billing") || trigger === "charge_reminder";
}

export function validateMessage(payload: SendMessagePayload): void {
  const fields: ApiErrorField[] = [];
  if (!payload.recipientName.trim()) fields.push({ field: "recipientName", message: "Informe o destinatário." });
  if (!whatsappNumber(payload.recipientPhone)) {
    fields.push({ field: "recipientPhone", message: "Informe um WhatsApp com DDD." });
  }
  if (!payload.content.trim()) fields.push({ field: "content", message: "Escreva a mensagem." });
  // Emoji conta 1, como no contador da tela (ALU-38).
  else if (charCount(payload.content.trim()) > MESSAGE_MAX_LENGTH) {
    fields.push({ field: "content", message: `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.` });
  }
  if (fields.length > 0) throw validationError(fields);
}

export function newLog(payload: SendMessagePayload, status: MessageLog["status"], idOverride?: string): MessageLog {
  return {
    id: idOverride ?? newId(),
    organizationId: store.organization.id,
    recipientName: payload.recipientName.trim(),
    recipientPhone: whatsappNumber(payload.recipientPhone) ?? payload.recipientPhone.replace(/\D/g, ""),
    trigger: payload.trigger ?? "manual_broadcast",
    category: categoryOf(payload.trigger),
    content: payload.content.trim(),
    status,
    ...(payload.clientId ? { clientId: payload.clientId } : {}),
    ...(payload.chargeId ? { chargeId: payload.chargeId } : {}),
    sentAt: nowIso(),
  };
}

/**
 * Parabens automatico (so no envio oficial): no dia do aniversario, a partir
 * do horario da regra, uma mensagem por aluno por dia. Roda na rotina de hora
 * em hora (`birthdayGreetingsCron.ts`), nao mais na leitura do historico: antes
 * so saia se alguem abrisse a tela de mensagens, e a leitura gravava.
 */
export function runBirthdayGreetings(): number {
  if (!tenantHasFeature("messaging") || connectionView().mode !== "official") return 0;
  const connection = ensureConnection();
  const template = ensureTemplates().find((t) => t.trigger === "birthday_greeting");
  if (!template?.enabled) return 0;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  if (format(now, "HH:mm") < template.sendHour) return 0;

  const logs = ensureLogs();
  let sent = 0;
  for (const client of store.clients) {
    if (connection.monthlyQuota.used >= connection.monthlyQuota.included) break;
    if (client.status !== "active" || !whatsappNumber(client.phone)) continue;
    // Sem a autorizacao do aluno, o automatico nao sai (doc product/27 M1).
    if (!whatsappConsentGranted(client)) continue;
    if (!isBirthdayToday(client.birthDate, today)) continue;
    const alreadySent = logs.some(
      (log) =>
        log.trigger === "birthday_greeting" &&
        log.clientId === client.id &&
        dateInSpace(log.sentAt) === today,
    );
    if (alreadySent) continue;
    const log = newLog(
      {
        recipientName: client.name,
        recipientPhone: client.phone ?? "",
        trigger: "birthday_greeting",
        clientId: client.id,
        content: fillMessage(template.content, { aluno: client.name, empresa: store.organization.name }),
      },
      "delivered",
    );
    logs.unshift(log);
    connection.monthlyQuota.used += 1;
    sent += 1;
  }
  if (sent > 0) {
    persistLocal();
  }
  return sent;
}

/**
 * Lembretes automáticos de cobrança pelo WhatsApp oficial:
 * - Antes do vencimento (`billing_before_due`, padrão -3 dias)
 * - No dia do vencimento (`billing_due_date`, 0 dias)
 * - Após o vencimento (`billing_after_due`, padrão 3 dias)
 * Respeita o horário de envio permitido (`allowedSendHours`) e o horário da regra (`sendHour`).
 */
export function runBillingReminders(): number {
  if (!tenantHasFeature("messaging") || connectionView().mode !== "official") return 0;
  const connection = ensureConnection();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const currentHour = format(now, "HH:mm");

  if (connection.allowedSendHours) {
    if (currentHour < connection.allowedSendHours.start || currentHour > connection.allowedSendHours.end) {
      return 0;
    }
  }

  const templates = ensureTemplates().filter(
    (t) => t.enabled && isBillingReminder(t.trigger) && !isManualTrigger(t.trigger),
  );
  if (templates.length === 0) return 0;

  const logs = ensureLogs();
  let sent = 0;

  for (const template of templates) {
    if (currentHour < template.sendHour) continue;

    const offset =
      template.daysOffset ??
      (template.trigger === "billing_before_due" ? -3 : template.trigger === "billing_after_due" ? 3 : 0);

    const targetDateObj = new Date(now.getTime() - offset * 86_400_000);
    const targetDueDate = format(targetDateObj, "yyyy-MM-dd");

    const targetCharges = (store.charges ?? []).filter(
      (c) => (c.status === "pending" || c.status === "overdue") && c.dueDate === targetDueDate,
    );

    for (const charge of targetCharges) {
      if (connection.monthlyQuota.used >= connection.monthlyQuota.included) break;
      const client = (store.clients ?? []).find((cl) => cl.id === charge.studentId);
      if (!client || client.status !== "active" || !whatsappNumber(client.phone)) continue;
      // Sem a autorizacao do aluno, o automatico nao sai (doc product/27 M1).
      if (!whatsappConsentGranted(client)) continue;

      const alreadySent = logs.some(
        (log) =>
          log.chargeId === charge.id &&
          log.trigger === template.trigger &&
          dateInSpace(log.sentAt) === today,
      );
      if (alreadySent) continue;

      const [y, m, d] = charge.dueDate.split("-");
      const formattedDueDate = `${d}/${m}/${y}`;
      const amountFormatted = (charge.amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const onlinePayment = (store.onlinePayments ?? []).find(
        (p) => p.chargeId === charge.id && p.status !== "canceled" && p.status !== "expired",
      );
      const hasOnlinePayments = Boolean(
        store.organization.settings?.onlinePayments?.enabled,
      );
      const paymentLink = onlinePayment?.publicCode
        ? paymentPageUrl(onlinePayment.publicCode)
        : onlinePayment?.linkUrl
          ? onlinePayment.linkUrl
          : hasOnlinePayments
            ? chargeInvoiceUrl(charge.id)
            : "";

      const content = fillMessage(template.content, {
        aluno: client.name,
        valor: amountFormatted,
        vencimento: formattedDueDate,
        empresa: store.organization.name,
        link_pagamento: paymentLink,
      });

      const log = newLog(
        {
          recipientName: client.name,
          recipientPhone: client.phone ?? "",
          trigger: template.trigger,
          clientId: client.id,
          chargeId: charge.id,
          content,
        },
        "delivered",
      );
      logs.unshift(log);
      connection.monthlyQuota.used += 1;
      sent += 1;
    }
  }

  if (sent > 0) {
    persistLocal();
  }
  return sent;
}

// --- Fila de envio (oficial) -------------------------------------------------

/** O que o efeito depois da gravacao precisa para entregar uma mensagem "Na fila". */
export interface QueuedMessageJob {
  logId: string;
  organizationId: string;
  phone: string;
  content: string;
}

let queuedMessageDeliverer: ((job: QueuedMessageJob) => Promise<void>) | null = null;

/** Registrado pelo servidor (`messageDelivery.ts`); no navegador e nos testes fica vazio. */
export function setQueuedMessageDeliverer(fn: ((job: QueuedMessageJob) => Promise<void>) | null): void {
  queuedMessageDeliverer = fn;
}

export function getQueuedMessageDeliverer(): ((job: QueuedMessageJob) => Promise<void>) | null {
  return queuedMessageDeliverer;
}
