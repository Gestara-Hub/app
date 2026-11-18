import type {
  CommunicationMetrics,
  DateISO,
  Id,
  MessageClassGroupOption,
  MessageComposerContext,
  MessageLog,
  MessageLogFilter,
  MessageLogKind,
  MessageRecipientOption,
  PaginatedResult,
  SendMessagePayload,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { isManualTrigger, whatsappNumber } from "@/lib/whatsapp";
import { apiError, nowIso, readOp, writeOp } from "@/services/world/ops";
import { inServerWorld, store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { whatsappConsentGranted } from "../clients/clientConsentRules";
import { teacherSeesClass, teacherStudentIds } from "../classes/teacherScope";
import { assertFeature } from "../subscription/subscriptionService";
import {
  connectionView,
  ensureTemplates,
  ensureLogs,
  isBillingReminder,
  validateMessage,
  newLog,
  getQueuedMessageDeliverer,
  dispatchOfficial,
  officialTemplateFor,
} from "./communicationRules";
import { dateInSpace } from "@gestarahub/core/date";
import { metaErrorReason, sendOfficial, whatsappClient } from "./whatsappClient";

/**
 * Tipo da mensagem no filtro do historico. A mesma regra vale na consulta do
 * banco (`messageLogPage.ts`): Aula cancelada, mudanca de horario e feriado
 * sao "Avisos" (antes caiam em "Avulsa").
 */
export function messageKindMatches(log: Pick<MessageLog, "trigger" | "category">, kind?: MessageLogKind): boolean {
  if (kind === "manual") return log.trigger === "manual_broadcast";
  if (kind === "billing") return log.category === "billing";
  if (kind === "retention") return log.category === "retention";
  if (kind === "notices") return log.category === "administrative" && log.trigger !== "manual_broadcast";
  return true;
}

/** Mensagens: historico, envio assistido ou oficial, reenvio e metricas. */
export const messagesService = {
  listLogs(filter?: {
    trigger?: string;
    status?: string;
    search?: string;
    clientId?: Id;
    dateFrom?: DateISO;
    dateTo?: DateISO;
  }): Promise<MessageLog[]> {
    return readOp(async () => {
      let logs = [...ensureLogs()];
      // Ficha do aluno: so as mensagens dele.
      if (filter?.clientId) logs = logs.filter((l) => l.clientId === filter.clientId);
      if (filter?.trigger && filter.trigger !== "all") logs = logs.filter((l) => l.trigger === filter.trigger);
      if (filter?.status && filter.status !== "all") logs = logs.filter((l) => l.status === filter.status);
      if (filter?.dateFrom) {
        const from = filter.dateFrom.slice(0, 10);
        logs = logs.filter((l) => dateInSpace(l.sentAt) >= from);
      }
      if (filter?.dateTo) {
        const to = filter.dateTo.slice(0, 10);
        logs = logs.filter((l) => dateInSpace(l.sentAt) <= to);
      }
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
  /** Uma pagina do historico (no espaco local; a conta real pagina no banco, `messageLogsPage`). */
  listLogsPaginated(filter?: MessageLogFilter): Promise<PaginatedResult<MessageLog>> {
    return readOp(async () => {
      const all = (await messagesService.listLogs(filter)).filter((log) => messageKindMatches(log, filter?.kind));
      return paginateArray(all, filter?.page, filter?.pageSize);
    });
  },
  /**
   * Envio assistido: a tela ja abriu o WhatsApp com o texto. Registra
   * "Aberto no WhatsApp" (o envio em si nao e confirmado).
   */
  registerAssistedMessage(payload: SendMessagePayload): Promise<MessageLog> {
    return writeOp(async () => {
      validateMessage(payload);
      const log = newLog(payload, "opened");
      ensureLogs().unshift(log);

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
    return writeOp(async () => {
      assertFeature("messaging");
      const view = connectionView();
      if (view.mode !== "official") {
        throw apiError("SERVICE_UNAVAILABLE", "Conecte o WhatsApp oficial do espaço para enviar automaticamente.", {
          httpStatus: 409,
        });
      }
      validateMessage(payload);
      // Envio oficial so para quem autorizou (doc product/27 M1): a Politica do
      // WhatsApp Business pede o opt-in antes de mensagem iniciada pelo espaco.
      // O envio assistido (pelo celular de quem atende) continua.
      const recipient = payload.clientId ? store.clients.find((c) => c.id === payload.clientId) : undefined;
      if (recipient && !whatsappConsentGranted(recipient)) {
        throw apiError(
          "CONFLICT",
          recipient.whatsappConsentStatus === "revoked"
            ? `${recipient.name} pediu para não receber mensagens pelo WhatsApp do espaço.`
            : `${recipient.name} ainda não autorizou mensagens pelo WhatsApp do espaço. Marque "Aceita mensagens pelo WhatsApp" no cadastro.`,
          { httpStatus: 409, fields: [{ field: "whatsappConsentStatus", message: "Sem autorização para WhatsApp." }] },
        );
      }
      let messageId: string | undefined;
      let status: MessageLog["status"] = "sent";
      let errorReason: string | undefined;
      // Mensagem do modelo do espaco: sai pelo modelo aprovado da Meta (doc technical/07 §3.3).
      const metaTemplate = officialTemplateFor(payload.trigger, payload.content, payload.variables);
      let queued = false;

      const metaConfig = await whatsappClient.configFor(store.organization.id);
      if (metaConfig) {
        // No servidor, a Meta e chamada depois da gravacao e da resposta
        // (01/11/2026): a tela nao espera os segundos da API, e o registro
        // nasce "Na fila" ate a Meta responder (`messageDelivery.ts`).
        if (getQueuedMessageDeliverer() && inServerWorld()) {
          queued = true;
        } else {
          try {
            const res = await sendOfficial(payload.recipientPhone, payload.content, metaTemplate, metaConfig);
            messageId = res.messages?.[0]?.id;
            status = "sent";
          } catch (err: unknown) {
            status = "failed";
            errorReason = metaErrorReason(err);
          }
        }
      } else {
        status = "delivered";
      }

      const log = newLog(payload, status, messageId);
      if (metaTemplate) log.metaTemplate = metaTemplate;
      if (errorReason) {
        log.errorReason = errorReason;
      }
      if (queued) dispatchOfficial(log);
      ensureLogs().unshift(log);

      auditLogService.record({
        action: "created",
        target: { type: "message_log", id: log.id, label: `Mensagem para ${log.recipientName}` },
        predicate: `enviou mensagem de WhatsApp para ${log.recipientName}`,
      });

      if (status === "failed") {
        throw apiError("SERVICE_UNAVAILABLE", errorReason ?? "Falha ao enviar mensagem de WhatsApp.", {
          httpStatus: 502,
        });
      }

      return { ...log };
    });
  },
  retryFailedMessage(id: Id): Promise<MessageLog> {
    return writeOp(async () => {
      assertFeature("messaging");
      if (connectionView().mode !== "official") {
        throw apiError("SERVICE_UNAVAILABLE", "Conecte o WhatsApp oficial do espaço para reenviar.", {
          httpStatus: 409,
        });
      }
      const log = ensureLogs().find((l) => l.id === id);
      if (!log) throw apiError("NOT_FOUND", "Mensagem não encontrada.", { httpStatus: 404 });

      const metaConfig = await whatsappClient.configFor(store.organization.id);
      if (metaConfig && getQueuedMessageDeliverer() && inServerWorld()) {
        // Pela fila, como o envio: repete o mesmo modelo (ou o texto) do registro.
        delete log.errorReason;
        log.sentAt = nowIso();
        dispatchOfficial(log);
      } else if (metaConfig) {
        try {
          const res = await sendOfficial(log.recipientPhone, log.content, log.metaTemplate, metaConfig);
          if (res.messages?.[0]?.id) {
            log.id = res.messages[0].id;
          }
          log.status = "sent";
          delete log.errorReason;
          log.sentAt = nowIso();
        } catch (err: unknown) {
          log.status = "failed";
          log.errorReason = metaErrorReason(err);
          throw apiError("SERVICE_UNAVAILABLE", log.errorReason, { httpStatus: 502 });
        }
      } else {
        log.status = "delivered";
        delete log.errorReason;
        log.sentAt = nowIso();
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
    return readOp(async () => {
      const view = connectionView();
      const month = dateInSpace().slice(0, 7);
      const localMonth = (iso: string) => dateInSpace(iso).slice(0, 7);
      const monthLogs = ensureLogs().filter((l) => localMonth(l.sentAt) === month);
      const sent = monthLogs.filter((l) => l.status !== "opened");
      const delivered = sent.filter((l) => l.status === "delivered" || l.status === "read").length;
      const read = sent.filter((l) => l.status === "read").length;
      const failed = monthLogs.filter((l) => l.status === "failed").length;
      const inProgress = sent.filter((l) => l.status === "queued" || l.status === "sent").length;

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
        // Taxas so no oficial (no assistido nao ha entrega a medir).
        deliveryRate:
          view.mode === "official" && sent.length > 0 ? Math.round((delivered / sent.length) * 1000) / 10 : null,
        readRate: view.mode === "official" && sent.length > 0 ? Math.round((read / sent.length) * 1000) / 10 : null,
        sentCount: sent.length,
        deliveredCount: delivered,
        readCount: read,
        failedCount: failed,
        inProgressCount: inProgress,
        recoveredAmountCents,
        activeAutomationsCount: ensureTemplates().filter((t) => t.enabled && !isManualTrigger(t.trigger)).length,
      };
    });
  },
  /** Alunos com WhatsApp, turmas ativas e contagem de autorizacoes para o compositor. */
  getComposerContext(): Promise<MessageComposerContext> {
    return readOp(async () => {
      const allowedStudentIds = teacherStudentIds();
      const visibleClients = store.clients.filter(
        (c) => c.status === "active" && (allowedStudentIds === undefined || allowedStudentIds.has(c.id)),
      );
      const recipients: MessageRecipientOption[] = visibleClients
        .filter((c) => Boolean(whatsappNumber(c.phone)))
        .map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          whatsappConsentStatus: c.whatsappConsentStatus ?? "unknown",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      const recipientIds = new Set(recipients.map((r) => r.id));
      const classGroups: MessageClassGroupOption[] = (store.classGroups ?? [])
        .filter((g) => g.status === "active" && teacherSeesClass(g))
        .map((g) => {
          const studentIds = Array.from(
            new Set(
              (store.enrollments ?? [])
                .filter((e) => e.classGroupId === g.id && e.status === "active" && recipientIds.has(e.studentId))
                .map((e) => e.studentId),
            ),
          );
          return { id: g.id, name: g.name, studentIds };
        })
        .filter((g) => g.studentIds.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      let consentedCount = 0;
      let revokedConsentCount = 0;
      let missingConsentCount = 0;
      for (const client of visibleClients) {
        if (whatsappConsentGranted(client)) {
          consentedCount += 1;
        } else if (client.whatsappConsentStatus === "revoked") {
          revokedConsentCount += 1;
        } else {
          missingConsentCount += 1;
        }
      }

      return {
        recipients,
        classGroups,
        activeStudentsCount: visibleClients.length,
        consentedCount,
        missingConsentCount,
        revokedConsentCount,
      };
    });
  },
};
