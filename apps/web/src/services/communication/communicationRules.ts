import type {
ApiErrorField,MessageCategory,
MessageLog,MessageTemplate,
MessageTrigger,SendMessagePayload,WhatsAppConnection,
WhatsAppConnectionView
} from "@gestarahub/contracts";
import { format,parseISO } from "date-fns";
import { isBirthdayToday } from "@/lib/birthdays";
import { MESSAGE_MAX_LENGTH,fillMessage,whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import {
newId,
nowIso,persistLocal,
validationError
} from "@/services/world/ops";
import { defaultMessageTemplates,defaultWhatsAppConnection } from "@/services/defaults";
import { store } from "@/services/world/store";
import { tenantHasFeature } from "../subscriptionService";

/**
 * Comunicacao pelo WhatsApp do proprio espaco (docs/product/13, secao 5):
 * envio assistido no gratis (o aparelho abre o WhatsApp com o texto; aqui so
 * registramos "Aberto no WhatsApp") e envio automatico pela API oficial no Pro.
 */

/**
 * Apoio da comunicacao: conexao, modelos e historico do espaco, categoria do gatilho, validacao e parabens do dia.
 */

export function ensureConnection(): WhatsAppConnection {
  if (!store.whatsAppConnection) {
    store.whatsAppConnection = defaultWhatsAppConnection(store.organization.id);
  }
  return store.whatsAppConnection;
}

export function connectionView(): WhatsAppConnectionView {
  const connection = ensureConnection();
  const canUseOfficial = tenantHasFeature("messaging");
  return {
    ...connection,
    canUseOfficial,
    mode: canUseOfficial && connection.officialStatus === "connected" ? "official" : "assisted",
  };
}

export function ensureTemplates(): MessageTemplate[] {
  if (!store.messageTemplates || store.messageTemplates.length === 0) {
    store.messageTemplates = defaultMessageTemplates(store.organization.id, store.organization.classSegment);
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

export function newLog(payload: SendMessagePayload, status: MessageLog["status"]): MessageLog {
  return {
    id: newId(),
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
 * do horario da regra, uma mensagem por aluno por dia. Roda na leitura, como a
 * geracao automatica de mensalidades; no backend vira tarefa agendada.
 */
export function runBirthdayGreetings(): number {
  if (connectionView().mode !== "official") return 0;
  const connection = ensureConnection();
  const template = ensureTemplates().find((t) => t.trigger === "birthday_greeting");
  if (!template?.enabled) return 0;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  if (format(now, "HH:mm") < template.sendHour) return 0;

  const logs = ensureLogs();
  let sent = 0;
  for (const client of store.clients) {
    if (client.status !== "active" || !whatsappNumber(client.phone)) continue;
    if (!isBirthdayToday(client.birthDate, today)) continue;
    const alreadySent = logs.some(
      (log) =>
        log.trigger === "birthday_greeting" &&
        log.clientId === client.id &&
        format(parseISO(log.sentAt), "yyyy-MM-dd") === today,
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
