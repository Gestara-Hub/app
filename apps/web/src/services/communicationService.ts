import type {
  CommunicationMetrics,
  Id,
  MessageCategory,
  MessageLog,
  MessageTemplate,
  SendMessagePayload,
  UpdateSessionSettingsPayload,
  UpdateTemplatePayload,
  WhatsAppSession,
} from "@gestarahub/contracts";
import {
  apiError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { defaultMessageLogs, defaultMessageTemplates, defaultWhatsAppSession } from "@/mocks/seed";
import { store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
import { assertFeature } from "./subscriptionService";

function ensureSession(): WhatsAppSession {
  if (!store.communicationSession) {
    store.communicationSession = defaultWhatsAppSession(store.organization.id);
  }
  return store.communicationSession;
}

function ensureTemplates(): MessageTemplate[] {
  if (!store.messageTemplates || store.messageTemplates.length === 0) {
    store.messageTemplates = defaultMessageTemplates(store.organization.id);
  }
  return store.messageTemplates;
}

function ensureLogs(): MessageLog[] {
  if (!store.messageLogs) {
    store.messageLogs = defaultMessageLogs(store.organization.id);
  }
  return store.messageLogs;
}

export const communicationService = {
  getSession(): Promise<WhatsAppSession> {
    return simulateRead(() => ensureSession());
  },

  connectWhatsApp(): Promise<WhatsAppSession> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const session = ensureSession();
      if (session.status === "disconnected") {
        session.status = "qr_ready";
        session.qrCodePayload = `gestarahub:wa:pair:${store.organization.id}:${Date.now()}`;
      } else {
        session.status = "connected";
        session.phoneNumber = session.phoneNumber || "5511987654321";
        session.profileName = session.profileName || store.organization.name;
        session.connectedAt = nowIso();
        session.batteryLevel = 95;
        session.qrCodePayload = undefined;
      }
      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "Conexão WhatsApp" },
        predicate: "conectou a instância do WhatsApp",
      });
      return { ...session };
    });
  },

  disconnectWhatsApp(): Promise<WhatsAppSession> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const session = ensureSession();
      session.status = "disconnected";
      session.connectedAt = undefined;
      session.qrCodePayload = undefined;
      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "Desconexão WhatsApp" },
        predicate: "desconectou a instância do WhatsApp",
      });
      return { ...session };
    });
  },

  updateSessionSettings(payload: UpdateSessionSettingsPayload): Promise<WhatsAppSession> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const session = ensureSession();
      if (payload.allowedSendHours) {
        session.allowedSendHours = { ...payload.allowedSendHours };
      }
      return { ...session };
    });
  },

  listTemplates(): Promise<MessageTemplate[]> {
    return simulateRead(() => {
      const templates = ensureTemplates();
      return [...templates].sort((a, b) => a.daysOffset - b.daysOffset);
    });
  },

  updateTemplate(payload: UpdateTemplatePayload): Promise<MessageTemplate> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const templates = ensureTemplates();
      const template = templates.find((t) => t.id === payload.id);
      if (!template) {
        throw apiError("NOT_FOUND", "Template de mensagem não encontrado.", {
          httpStatus: 404,
        });
      }

      if (payload.enabled !== undefined) {
        template.enabled = payload.enabled;
      }
      if (payload.sendHour !== undefined) {
        template.sendHour = payload.sendHour;
      }
      if (payload.daysOffset !== undefined) {
        template.daysOffset = payload.daysOffset;
      }
      if (payload.content !== undefined) {
        if (!payload.content.trim()) {
          throw validationError([
            { field: "content", message: "O conteúdo da mensagem não pode ficar vazio." },
          ]);
        }
        template.content = payload.content;
      }

      template.updatedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "message_template", label: `Regra de Envio: ${template.title}` },
        predicate: `atualizou as configurações da regra "${template.title}"`,
      });

      return { ...template };
    });
  },

  listLogs(filter?: {
    trigger?: string;
    status?: string;
    search?: string;
  }): Promise<MessageLog[]> {
    return simulateRead(() => {
      let logs = [...ensureLogs()];

      if (filter?.trigger && filter.trigger !== "all") {
        logs = logs.filter((log) => log.trigger === filter.trigger);
      }

      if (filter?.status && filter.status !== "all") {
        logs = logs.filter((log) => log.status === filter.status);
      }

      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        logs = logs.filter(
          (log) =>
            log.recipientName.toLowerCase().includes(q) ||
            log.recipientPhone.includes(q) ||
            log.content.toLowerCase().includes(q),
        );
      }

      return logs.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );
    });
  },

  sendMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const session = ensureSession();
      if (session.status !== "connected") {
        throw apiError(
          "SERVICE_UNAVAILABLE",
          "WhatsApp não está conectado. Conecte sua instância para enviar mensagens.",
          { httpStatus: 400 },
        );
      }

      if (!payload.recipientName.trim()) {
        throw validationError([
          { field: "recipientName", message: "Nome do destinatário é obrigatório." },
        ]);
      }
      if (!payload.recipientPhone.trim()) {
        throw validationError([
          { field: "recipientPhone", message: "Telefone do destinatário é obrigatório." },
        ]);
      }
      if (!payload.content.trim()) {
        throw validationError([
          { field: "content", message: "A mensagem não pode estar vazia." },
        ]);
      }

      const logs = ensureLogs();
      const newLog: MessageLog = {
        id: `msg-${store.organization.id}-${Date.now()}`,
        organizationId: store.organization.id,
        recipientName: payload.recipientName.trim(),
        recipientPhone: payload.recipientPhone.replace(/\D/g, ""),
        trigger: payload.trigger || "manual_broadcast",
        category: (payload.trigger?.startsWith("billing")
          ? "billing"
          : "retention") as MessageCategory,
        content: payload.content.trim(),
        status: "delivered",
        sentAt: nowIso(),
      };

      logs.unshift(newLog);
      session.monthlyQuota.used += 1;

      auditLogService.record({
        action: "created",
        target: {
          type: "message_log",
          label: `Mensagem enviada para ${newLog.recipientName}`,
        },
        predicate: `enviou mensagem de WhatsApp para ${newLog.recipientName}`,
      });

      return newLog;
    });
  },

  retryFailedMessage(id: Id): Promise<MessageLog> {
    return simulateWrite(() => {
      assertFeature("messaging");
      const logs = ensureLogs();
      const log = logs.find((l) => l.id === id);
      if (!log) {
        throw apiError("NOT_FOUND", "Registro de mensagem não encontrado.", {
          httpStatus: 404,
        });
      }

      log.status = "delivered";
      log.errorReason = undefined;
      log.sentAt = nowIso();

      return { ...log };
    });
  },

  getMetrics(): Promise<CommunicationMetrics> {
    return simulateRead(() => {
      const session = ensureSession();
      const templates = ensureTemplates();
      const logs = ensureLogs();

      const totalSent = logs.length;
      const deliveredOrRead = logs.filter(
        (l) => l.status === "delivered" || l.status === "read",
      ).length;
      const readCount = logs.filter((l) => l.status === "read").length;

      const deliveryRate =
        totalSent > 0 ? Math.round((deliveredOrRead / totalSent) * 1000) / 10 : 100;
      const readRate =
        totalSent > 0 ? Math.round((readCount / totalSent) * 1000) / 10 : 88.5;

      const activeAutomationsCount = templates.filter((t) => t.enabled).length;

      return {
        sentThisMonth: session.monthlyQuota.used,
        monthlyQuota: session.monthlyQuota.included,
        deliveryRate,
        readRate,
        recoveredAmountCents: 425000, // R$ 4.250,00 recuperados via régua automática
        activeAutomationsCount,
      };
    });
  },
};
