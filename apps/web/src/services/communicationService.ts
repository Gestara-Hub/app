import type {
  ApiErrorField,
  CommunicationMetrics,
  Id,
  MessageCategory,
  MessageLog,
  MessageTemplate,
  SendMessagePayload,
  UpdateConnectionSettingsPayload,
  UpdateTemplatePayload,
  WhatsAppConnection,
  WhatsAppConnectionView,
} from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { isBirthdayToday } from "@/lib/birthdays";
import { fillMessage, whatsappNumber } from "@/lib/whatsapp";
import {
  apiError,
  newId,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { defaultMessageTemplates, defaultWhatsAppConnection } from "@/mocks/seed";
import { persist, store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
import { assertFeature, tenantHasFeature } from "./subscriptionService";

/**
 * Comunicacao pelo WhatsApp do proprio espaco (docs/product/13, secao 5):
 * envio assistido no gratis (o aparelho abre o WhatsApp com o texto; aqui so
 * registramos "Aberto no WhatsApp") e envio automatico pela API oficial no Pro.
 */

function ensureConnection(): WhatsAppConnection {
  if (!store.whatsAppConnection) {
    store.whatsAppConnection = defaultWhatsAppConnection(store.organization.id);
  }
  return store.whatsAppConnection;
}

function connectionView(): WhatsAppConnectionView {
  const connection = ensureConnection();
  const canUseOfficial = tenantHasFeature("messaging");
  return {
    ...connection,
    canUseOfficial,
    mode: canUseOfficial && connection.officialStatus === "connected" ? "official" : "assisted",
  };
}

function ensureTemplates(): MessageTemplate[] {
  if (!store.messageTemplates || store.messageTemplates.length === 0) {
    store.messageTemplates = defaultMessageTemplates(store.organization.id, store.organization.classSegment);
  }
  return store.messageTemplates;
}

function ensureLogs(): MessageLog[] {
  if (!store.messageLogs) store.messageLogs = [];
  return store.messageLogs;
}

function categoryOf(trigger?: string): MessageCategory {
  if (trigger?.startsWith("billing") || trigger === "charge_reminder") return "billing";
  if (trigger === "manual_broadcast" || !trigger) return "administrative";
  return "retention";
}

function validateMessage(payload: SendMessagePayload): void {
  const fields: ApiErrorField[] = [];
  if (!payload.recipientName.trim()) fields.push({ field: "recipientName", message: "Informe o destinatário." });
  if (!whatsappNumber(payload.recipientPhone)) {
    fields.push({ field: "recipientPhone", message: "Informe um WhatsApp com DDD." });
  }
  if (!payload.content.trim()) fields.push({ field: "content", message: "Escreva a mensagem." });
  if (fields.length > 0) throw validationError(fields);
}

function newLog(payload: SendMessagePayload, status: MessageLog["status"]): MessageLog {
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
function runBirthdayGreetings(): number {
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
    logs.unshift(
      newLog(
        {
          recipientName: client.name,
          recipientPhone: client.phone ?? "",
          trigger: "birthday_greeting",
          clientId: client.id,
          content: fillMessage(template.content, { aluno: client.name, empresa: store.organization.name }),
        },
        "delivered",
      ),
    );
    connection.monthlyQuota.used += 1;
    sent += 1;
  }
  if (sent > 0) persist();
  return sent;
}

export const communicationService = {
  getConnection(): Promise<WhatsAppConnectionView> {
    return simulateRead(() => connectionView());
  },

  /**
   * Conecta o numero do espaco a API oficial (Pro). No mock, o cadastro guiado
   * da Meta e simulado e ja volta conectado com o telefone da unidade.
   */
  connectOfficial(): Promise<WhatsAppConnectionView> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const connection = ensureConnection();
      const phone = whatsappNumber(store.unit.phone);
      if (!phone) {
        throw validationError([
          { field: "phoneNumber", message: "Cadastre o telefone do espaço em Configurações antes de conectar." },
        ]);
      }
      connection.officialStatus = "connected";
      connection.phoneNumber = phone;
      connection.displayName = store.organization.name;
      connection.connectedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "conectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },

  disconnectOfficial(): Promise<WhatsAppConnectionView> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const connection = ensureConnection();
      connection.officialStatus = "not_connected";
      delete connection.phoneNumber;
      delete connection.displayName;
      delete connection.connectedAt;
      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "desconectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },

  updateConnectionSettings(payload: UpdateConnectionSettingsPayload): Promise<WhatsAppConnectionView> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const connection = ensureConnection();
      if (payload.allowedSendHours) {
        const { start, end } = payload.allowedSendHours;
        if (!start || !end || start >= end) {
          throw validationError([{ field: "allowedSendHours", message: "O início precisa ser antes do fim." }]);
        }
        connection.allowedSendHours = { start, end };
      }
      return connectionView();
    });
  },

  listTemplates(): Promise<MessageTemplate[]> {
    return simulateRead(() => [...ensureTemplates()].sort((a, b) => a.daysOffset - b.daysOffset));
  },

  /**
   * Texto do modelo: liberado para todos (o envio assistido usa os mesmos
   * textos). Envio automatico, horario e prazo sao do Pro.
   */
  updateTemplate(payload: UpdateTemplatePayload): Promise<MessageTemplate> {
    return simulateWrite(() => {
      const template = ensureTemplates().find((t) => t.id === payload.id);
      if (!template) {
        throw apiError("NOT_FOUND", "Modelo de mensagem não encontrado.", { httpStatus: 404 });
      }
      const automationChange =
        (payload.enabled !== undefined && payload.enabled !== template.enabled) ||
        (payload.sendHour !== undefined && payload.sendHour !== template.sendHour) ||
        (payload.daysOffset !== undefined && payload.daysOffset !== template.daysOffset);
      if (automationChange) assertFeature("messaging");

      if (payload.content !== undefined) {
        if (!payload.content.trim()) {
          throw validationError([{ field: "content", message: "Escreva o texto da mensagem." }]);
        }
        template.content = payload.content.trim();
      }
      if (payload.enabled !== undefined) template.enabled = payload.enabled;
      if (payload.sendHour !== undefined) template.sendHour = payload.sendHour;
      if (payload.daysOffset !== undefined) template.daysOffset = payload.daysOffset;
      template.updatedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "message_template", label: template.title },
        predicate: `atualizou a mensagem "${template.title}"`,
      });
      return { ...template };
    });
  },

  listLogs(filter?: { trigger?: string; status?: string; search?: string }): Promise<MessageLog[]> {
    return simulateRead(() => {
      runBirthdayGreetings();
      let logs = [...ensureLogs()];
      if (filter?.trigger && filter.trigger !== "all") logs = logs.filter((l) => l.trigger === filter.trigger);
      if (filter?.status && filter.status !== "all") logs = logs.filter((l) => l.status === filter.status);
      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        logs = logs.filter(
          (l) =>
            l.recipientName.toLowerCase().includes(q) ||
            l.recipientPhone.includes(q.replace(/\D/g, "") || q) ||
            l.content.toLowerCase().includes(q),
        );
      }
      return logs.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    });
  },

  /**
   * Envio assistido: a tela ja abriu o WhatsApp com o texto. Registra
   * "Aberto no WhatsApp" (o envio em si nao e confirmado). Nao gasta franquia.
   */
  registerAssistedMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return simulateWrite(() => {
      validateMessage(payload);
      const log = newLog(payload, "opened");
      ensureLogs().unshift(log);
      return { ...log };
    });
  },

  /** Envio automatico pela API oficial (Pro e conectado). */
  sendMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return simulateWrite(() => {
      assertFeature("messaging");
      if (connectionView().mode !== "official") {
        throw apiError("SERVICE_UNAVAILABLE", "Conecte o WhatsApp oficial do espaço para enviar automaticamente.", {
          httpStatus: 409,
        });
      }
      validateMessage(payload);
      const connection = ensureConnection();
      const log = newLog(payload, "delivered");
      ensureLogs().unshift(log);
      connection.monthlyQuota.used += 1;
      auditLogService.record({
        action: "created",
        target: { type: "message_log", label: `Mensagem para ${log.recipientName}` },
        predicate: `enviou mensagem de WhatsApp para ${log.recipientName}`,
      });
      return { ...log };
    });
  },

  retryFailedMessage(id: Id): Promise<MessageLog> {
    return simulateWrite(() => {
      assertFeature("messaging");
      if (connectionView().mode !== "official") {
        throw apiError("SERVICE_UNAVAILABLE", "Conecte o WhatsApp oficial do espaço para reenviar.", {
          httpStatus: 409,
        });
      }
      const log = ensureLogs().find((l) => l.id === id);
      if (!log) throw apiError("NOT_FOUND", "Mensagem não encontrada.", { httpStatus: 404 });
      log.status = "delivered";
      delete log.errorReason;
      log.sentAt = nowIso();
      return { ...log };
    });
  },

  getMetrics(): Promise<CommunicationMetrics> {
    return simulateRead(() => {
      runBirthdayGreetings();
      const view = connectionView();
      const month = format(new Date(), "yyyy-MM");
      const localMonth = (iso: string) => format(parseISO(iso), "yyyy-MM");
      const monthLogs = ensureLogs().filter((l) => localMonth(l.sentAt) === month);
      const sent = monthLogs.filter((l) => l.status !== "opened");
      const delivered = sent.filter((l) => l.status === "delivered" || l.status === "read").length;
      const read = sent.filter((l) => l.status === "read").length;

      // Recuperado: mensalidade paga no mes depois de um lembrete de cobranca
      // ligado a ela (ou ao aluno) pelo WhatsApp.
      const billingLogs = ensureLogs().filter((l) => l.category === "billing");
      const recoveredAmountCents = store.charges
        .filter((c) => c.status === "paid" && Boolean(c.paidAt) && localMonth(c.paidAt as string) === month)
        .filter((c) =>
          billingLogs.some(
            (l) =>
              (l.chargeId === c.id || (!l.chargeId && l.clientId === c.studentId)) &&
              l.sentAt <= (c.paidAt ?? ""),
          ),
        )
        .reduce((sum, c) => sum + c.amountCents, 0);

      return {
        mode: view.mode,
        messagesThisMonth: view.mode === "official" ? sent.length : monthLogs.length,
        monthlyQuota: view.monthlyQuota.included,
        deliveryRate: sent.length > 0 ? Math.round((delivered / sent.length) * 1000) / 10 : null,
        readRate: sent.length > 0 ? Math.round((read / sent.length) * 1000) / 10 : null,
        recoveredAmountCents,
        activeAutomationsCount: ensureTemplates().filter((t) => t.enabled).length,
      };
    });
  },
};
