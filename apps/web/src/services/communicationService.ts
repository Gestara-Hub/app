import type {
  ApiErrorField,
  CommunicationMetrics,
  Id,
  MessageCategory,
  MessageLog,
  MessageLogFilter,
  MessageTemplate,
  MessageTrigger,
  PaginatedResult,
  SendMessagePayload,
  UpdateConnectionSettingsPayload,
  UpdateTemplatePayload,
  WhatsAppConnection,
  WhatsAppConnectionView,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { isBirthdayToday } from "@/lib/birthdays";
import { MESSAGE_MAX_LENGTH, TEMPLATE_MAX_LENGTH, fillMessage, isManualTrigger, whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
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
import { isSupabaseOrganization } from "@/lib/session";
import {
  createMessageLogInDb,
  getWhatsAppConnectionFromDb,
  insertMessageTemplatesBatchInDb,
  listMessageLogsFromDb,
  listMessageLogsPaginatedFromDb,
  listMessageTemplatesFromDb,
  saveWhatsAppConnectionInDb,
  updateMessageLogInDb,
  updateMessageTemplateInDb,
} from "./communicationBackend";

export async function syncCommunicationFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  const [connection, templates, logs] = await Promise.all([
    getWhatsAppConnectionFromDb(organizationId),
    listMessageTemplatesFromDb(organizationId),
    listMessageLogsFromDb(organizationId),
  ]);

  if (connection) {
    store.whatsAppConnection = connection;
  } else {
    const defaultConn = defaultWhatsAppConnection(organizationId);
    store.whatsAppConnection = defaultConn;
    try {
      await saveWhatsAppConnectionInDb(defaultConn);
    } catch (err) {
      console.error("[communicationService] Erro ao salvar conexão padrão no banco:", err);
    }
  }

  if (templates.length > 0) {
    store.messageTemplates = templates;
  } else {
    const defaultTemplates = defaultMessageTemplates(organizationId, store.organization.classSegment);
    store.messageTemplates = defaultTemplates;
    try {
      await insertMessageTemplatesBatchInDb(defaultTemplates);
    } catch (err) {
      console.error("[communicationService] Erro ao semear templates no banco:", err);
    }
  }

  const logMap = new Map(logs.map((l) => [l.id, l]));
  for (let i = 0; i < (store.messageLogs || []).length; i++) {
    const existing = store.messageLogs[i];
    if (existing.organizationId === organizationId) {
      const fromDb = logMap.get(existing.id);
      if (fromDb) {
        store.messageLogs[i] = fromDb;
        logMap.delete(existing.id);
      }
    }
  }
  if (!store.messageLogs) store.messageLogs = [];
  for (const l of logMap.values()) {
    store.messageLogs.push(l);
  }
}

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

const TRIGGER_CATEGORY: Record<MessageTrigger, MessageCategory> = {
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

function categoryOf(trigger?: MessageTrigger): MessageCategory {
  return trigger ? TRIGGER_CATEGORY[trigger] : "administrative";
}

/** Lembretes de cobranca: os que contam no valor recuperado. */
function isBillingReminder(trigger: MessageTrigger): boolean {
  return trigger.startsWith("billing") || trigger === "charge_reminder";
}

function validateMessage(payload: SendMessagePayload): void {
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
    if (isSupabaseOrganization(store.organization.id)) {
      void createMessageLogInDb(log).catch((err) =>
        console.error("[communicationService] Erro ao salvar parabéns no banco:", err),
      );
    }
  }
  if (sent > 0) {
    persist();
    if (isSupabaseOrganization(store.organization.id)) {
      void saveWhatsAppConnectionInDb(connection).catch((err) =>
        console.error("[communicationService] Erro ao atualizar quota no banco:", err),
      );
    }
  }
  return sent;
}

export const communicationService = {
  getConnection(): Promise<WhatsAppConnectionView> {
    return simulateRead(async () => {
      await syncCommunicationFromDb(store.organization.id);
      return connectionView();
    });
  },

  /**
   * Conecta o numero do espaco a API oficial (Pro). No mock, o cadastro guiado
   * da Meta e simulado e ja volta conectado com o telefone da unidade.
   */
  connectOfficial(): Promise<WhatsAppConnectionView> {
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await saveWhatsAppConnectionInDb(connection);
      }

      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "conectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },

  disconnectOfficial(): Promise<WhatsAppConnectionView> {
    return simulateWrite(async () => {
      assertFeature("messaging");
      const connection = ensureConnection();
      connection.officialStatus = "not_connected";
      delete connection.phoneNumber;
      delete connection.displayName;
      delete connection.connectedAt;

      if (isSupabaseOrganization(store.organization.id)) {
        await saveWhatsAppConnectionInDb(connection);
      }

      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "desconectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },

  updateConnectionSettings(payload: UpdateConnectionSettingsPayload): Promise<WhatsAppConnectionView> {
    return simulateWrite(async () => {
      assertFeature("messaging");
      const connection = ensureConnection();
      if (payload.allowedSendHours) {
        const { start, end } = payload.allowedSendHours;
        if (!start || !end || start >= end) {
          throw validationError([{ field: "allowedSendHours", message: "O início precisa ser antes do fim." }]);
        }
        connection.allowedSendHours = { start, end };
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await saveWhatsAppConnectionInDb(connection);
      }

      return connectionView();
    });
  },

  listTemplates(): Promise<MessageTemplate[]> {
    return simulateRead(async () => {
      await syncCommunicationFromDb(store.organization.id);
      return [...ensureTemplates()].sort((a, b) => a.daysOffset - b.daysOffset);
    });
  },

  /**
   * Texto do modelo: liberado para todos (o envio assistido usa os mesmos
   * textos). Envio automatico, horario e prazo sao do Pro.
   */
  updateTemplate(payload: UpdateTemplatePayload): Promise<MessageTemplate> {
    return simulateWrite(async () => {
      const template = ensureTemplates().find((t) => t.id === payload.id);
      if (!template) {
        throw apiError("NOT_FOUND", "Modelo de mensagem não encontrado.", { httpStatus: 404 });
      }
      const automationChange =
        (payload.enabled !== undefined && payload.enabled !== template.enabled) ||
        (payload.sendHour !== undefined && payload.sendHour !== template.sendHour) ||
        (payload.daysOffset !== undefined && payload.daysOffset !== template.daysOffset);
      if (automationChange) {
        if (isManualTrigger(template.trigger)) {
          throw validationError([{ field: "enabled", message: "Este modelo é só de envio manual." }]);
        }
        assertFeature("messaging");
      }

      if (payload.content !== undefined) {
        if (!payload.content.trim()) {
          throw validationError([{ field: "content", message: "Escreva o texto da mensagem." }]);
        }
        // Folga para os nomes: a mensagem enviada aceita ate 1000 caracteres.
        if (charCount(payload.content.trim()) > TEMPLATE_MAX_LENGTH) {
          throw validationError([{ field: "content", message: `Use no máximo ${TEMPLATE_MAX_LENGTH} caracteres.` }]);
        }
        template.content = payload.content.trim();
      }
      if (payload.enabled !== undefined) template.enabled = payload.enabled;
      if (payload.sendHour !== undefined) template.sendHour = payload.sendHour;
      if (payload.daysOffset !== undefined) template.daysOffset = payload.daysOffset;
      template.updatedAt = nowIso();

      if (isSupabaseOrganization(store.organization.id)) {
        await updateMessageTemplateInDb(template.id, payload, store.organization.id);
      }

      auditLogService.record({
        action: "updated",
        target: { type: "message_template", label: template.title },
        predicate: `atualizou a mensagem "${template.title}"`,
      });
      return { ...template };
    });
  },

  listLogs(filter?: { trigger?: string; status?: string; search?: string; clientId?: Id }): Promise<MessageLog[]> {
    return simulateRead(async () => {
      await syncCommunicationFromDb(store.organization.id);
      runBirthdayGreetings();
      let logs = [...ensureLogs()];
      // Ficha do aluno: so as mensagens dele.
      if (filter?.clientId) logs = logs.filter((l) => l.clientId === filter.clientId);
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

  listLogsPaginated(filter?: MessageLogFilter): Promise<PaginatedResult<MessageLog>> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        return listMessageLogsPaginatedFromDb(store.organization.id, filter);
      }
      const all = await communicationService.listLogs(filter);
      return paginateArray(all, filter?.page, filter?.pageSize);
    });
  },

  /**
   * Envio assistido: a tela ja abriu o WhatsApp com o texto. Registra
   * "Aberto no WhatsApp" (o envio em si nao e confirmado). Nao gasta franquia.
   */
  registerAssistedMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return simulateWrite(async () => {
      validateMessage(payload);
      const log = newLog(payload, "opened");
      ensureLogs().unshift(log);

      if (isSupabaseOrganization(store.organization.id)) {
        await createMessageLogInDb(log);
      }

      // Envio assistido: so da para saber que abriu o WhatsApp com o texto.
      auditLogService.record({
        action: "created",
        target: { type: "message_log", id: log.id, label: `Mensagem para ${log.recipientName}` },
        predicate: `abriu no WhatsApp uma mensagem para ${log.recipientName}`,
      });
      return { ...log };
    });
  },

  /** Envio automatico pela API oficial (Pro e conectado). */
  sendMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await Promise.all([
          createMessageLogInDb(log),
          saveWhatsAppConnectionInDb(connection),
        ]);
      }

      auditLogService.record({
        action: "created",
        target: { type: "message_log", id: log.id, label: `Mensagem para ${log.recipientName}` },
        predicate: `enviou mensagem de WhatsApp para ${log.recipientName}`,
      });
      return { ...log };
    });
  },

  retryFailedMessage(id: Id): Promise<MessageLog> {
    return simulateWrite(async () => {
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

      if (isSupabaseOrganization(store.organization.id)) {
        await updateMessageLogInDb(log);
      }

      auditLogService.record({
        action: "updated",
        target: { type: "message_log", id: log.id, label: `Mensagem para ${log.recipientName}` },
        predicate: `reenviou a mensagem de WhatsApp para ${log.recipientName}`,
      });
      return { ...log };
    });
  },

  getMetrics(): Promise<CommunicationMetrics> {
    return simulateRead(async () => {
      await syncCommunicationFromDb(store.organization.id);
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
      // "Pagamento recebido" e cobranca, mas vem depois do pagamento: nao conta.
      const billingLogs = ensureLogs().filter((l) => isBillingReminder(l.trigger));
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
        // Assistido: so as abertas no WhatsApp (falha nao conta).
        messagesThisMonth:
          view.mode === "official" ? sent.length : monthLogs.filter((l) => l.status === "opened").length,
        monthlyQuota: view.monthlyQuota.included,
        // Taxas so no oficial (no assistido nao ha entrega a medir).
        deliveryRate:
          view.mode === "official" && sent.length > 0 ? Math.round((delivered / sent.length) * 1000) / 10 : null,
        readRate: view.mode === "official" && sent.length > 0 ? Math.round((read / sent.length) * 1000) / 10 : null,
        recoveredAmountCents,
        activeAutomationsCount: ensureTemplates().filter((t) => t.enabled && !isManualTrigger(t.trigger)).length,
      };
    });
  },
};
