import type {
  CommunicationMetrics,
  Id,
  MessageLog,
  MessageLogFilter,
  MessageLogKind,
  PaginatedResult,
  SendMessagePayload,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { isManualTrigger } from "@/lib/whatsapp";
import { apiError, nowIso, readOp, writeOp } from "@/services/world/ops";
import { inServerWorld, store } from "@/services/world/store";
import { afterWorldCommit } from "@/services/world/effects";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import {
  ensureConnection,
  connectionView,
  ensureTemplates,
  ensureLogs,
  isBillingReminder,
  validateMessage,
  newLog,
  getQueuedMessageDeliverer,
  type QueuedMessageJob,
} from "./communicationRules";
import { dateInSpace } from "@gestarahub/core/date";
import { whatsappClient } from "./whatsappClient";

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
  listLogs(filter?: { trigger?: string; status?: string; search?: string; clientId?: Id }): Promise<MessageLog[]> {
    return readOp(async () => {
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
  /** Uma pagina do historico (no espaco local; a conta real pagina no banco, `messageLogsPage`). */
  listLogsPaginated(filter?: MessageLogFilter): Promise<PaginatedResult<MessageLog>> {
    return readOp(async () => {
      const all = (await messagesService.listLogs(filter)).filter((log) => messageKindMatches(log, filter?.kind));
      return paginateArray(all, filter?.page, filter?.pageSize);
    });
  },
  /**
   * Envio assistido: a tela ja abriu o WhatsApp com o texto. Registra
   * "Aberto no WhatsApp" (o envio em si nao e confirmado). Nao gasta franquia.
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
        if (view.isQuotaExhausted) {
          throw apiError(
            "CONFLICT",
            `Franquia de mensagens automáticas atingida (${view.monthlyQuota.used} de ${view.monthlyQuota.included}). Use o envio assistido até a franquia renovar, no próximo ciclo do plano.`,
            { httpStatus: 409 },
          );
        }
        throw apiError("SERVICE_UNAVAILABLE", "Conecte o WhatsApp oficial do espaço para enviar automaticamente.", {
          httpStatus: 409,
        });
      }
      validateMessage(payload);
      const connection = ensureConnection();

      let messageId: string | undefined;
      let status: MessageLog["status"] = "sent";
      let errorReason: string | undefined;
      let queuedJob: Omit<QueuedMessageJob, "logId"> | null = null;

      if (whatsappClient.isConfigured()) {
        // No servidor, a Meta e chamada depois da gravacao e da resposta
        // (01/11/2026): a tela nao espera os segundos da API, e o registro
        // nasce "Na fila" ate a Meta responder (`messageDelivery.ts`).
        const deliver = getQueuedMessageDeliverer();
        if (deliver && inServerWorld()) {
          status = "queued";
          queuedJob = { organizationId: store.organization.id, phone: payload.recipientPhone, content: payload.content };
        } else {
          try {
            const res = await whatsappClient.sendTextMessage(payload.recipientPhone, payload.content);
            messageId = res.messages?.[0]?.id;
            status = "sent";
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao enviar mensagem.";
            status = "failed";
            errorReason = errorMsg;
          }
        }
      } else {
        status = "delivered";
      }

      const log = newLog(payload, status, messageId);
      if (errorReason) {
        log.errorReason = errorReason;
      }
      if (queuedJob) {
        const job: QueuedMessageJob = { ...queuedJob, logId: log.id };
        const deliver = getQueuedMessageDeliverer()!;
        if (!afterWorldCommit(() => deliver(job))) {
          // Sem efeito depois da gravacao (nao deveria acontecer no servidor): envia agora.
          log.status = "sent";
          await deliver(job);
        }
      }
      ensureLogs().unshift(log);
      connection.monthlyQuota.used += 1;

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

      if (whatsappClient.isConfigured()) {
        try {
          const res = await whatsappClient.sendTextMessage(log.recipientPhone, log.content);
          if (res.messages?.[0]?.id) {
            log.id = res.messages[0].id;
          }
          log.status = "sent";
          delete log.errorReason;
          log.sentAt = nowIso();
        } catch (err: unknown) {
          log.status = "failed";
          log.errorReason = err instanceof Error ? err.message : "Falha ao reenviar mensagem.";
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
