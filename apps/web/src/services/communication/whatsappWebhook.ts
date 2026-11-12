import type { MetaTemplateStatus, WhatsAppWebhookPayload, WhatsAppWebhookStatus } from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/log";
import { store } from "@/services/world/store";
import { applyWhatsAppOptOut, isOptOutText } from "./whatsappOptOut";

/**
 * Atualiza o status de entrega e leitura de uma mensagem enviada via WhatsApp.
 * Suporta atualização no Supabase (produção) e no store local em memória.
 */
export async function processWhatsAppStatusUpdate(status: WhatsAppWebhookStatus): Promise<void> {
  const wamid = status.id;
  const mappedStatus = status.status;
  const timestampIso = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const errorReason =
    status.status === "failed"
      ? status.errors?.[0]?.message || status.errors?.[0]?.title || "Falha na entrega"
      : undefined;

  // 1. Atualizar no banco Supabase (se configurado)
  try {
    const admin = createSupabaseAdminClient();
    const updateData: Record<string, unknown> = {
      status: mappedStatus,
    };
    if (mappedStatus === "read") {
      updateData.read_at = timestampIso;
    }
    if (errorReason) {
      updateData.error_reason = errorReason;
    }

    const { error } = await admin.from("message_logs").update(updateData).eq("id", wamid);
    if (error) {
      logWarn(`[WhatsApp Webhook] Erro ao atualizar status no banco para ${wamid}:`, error);
    }
  } catch {
    // Supabase admin pode não estar configurado em ambiente puramente mock
  }

  // 2. Atualizar no store local (se existir o registro)
  try {
    const localLog = store.messageLogs?.find((l) => l.id === wamid);
    if (localLog) {
      localLog.status = mappedStatus;
      if (mappedStatus === "read") {
        localLog.readAt = timestampIso;
      }
      if (errorReason) {
        localLog.errorReason = errorReason;
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Processa um payload completo recebido da Meta via Webhook.
 */
export async function handleWhatsAppWebhookPayload(payload: WhatsAppWebhookPayload): Promise<{
  statusesProcessed: number;
  messagesReceived: number;
}> {
  let statusesProcessed = 0;
  let messagesReceived = 0;

  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return { statusesProcessed, messagesReceived };
  }

  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== "messages" || !change.value) continue;

      // 1. Processar atualizações de status (sent, delivered, read, failed)
      if (change.field === "messages" && change.value) {
        if (Array.isArray(change.value.statuses)) {
          for (const status of change.value.statuses) {
            try {
              await processWhatsAppStatusUpdate(status);
              statusesProcessed++;
            } catch (err) {
              logError("[WhatsApp Webhook] Erro ao processar atualização de status:", err);
            }
          }
        }

        // 2. Mensagens recebidas (respostas de alunos). "SAIR", "PARAR" ou
        // "CANCELAR" param o envio oficial do espaco (doc product/27 M2).
        if (Array.isArray(change.value.messages)) {
          messagesReceived += change.value.messages.length;
          for (const message of change.value.messages) {
            if (message.type !== "text" || !isOptOutText(message.text?.body)) continue;
            try {
              await applyWhatsAppOptOut(createSupabaseAdminClient(), {
                from: message.from,
                businessNumber: change.value.metadata?.display_phone_number,
              });
            } catch (err) {
              logError("[WhatsApp Webhook] Erro ao registrar o pedido para parar:", err);
            }
          }
        }
      }

      // 3. Atualização de status de template da Meta (APPROVED, REJECTED, PAUSED)
      if ((change.field as string) === "message_template_status_update" && change.value) {
        const templateEvent = change.value as unknown as {
          event?: MetaTemplateStatus;
          message_template_name?: string;
          reason?: string;
        };
        if (templateEvent.message_template_name && templateEvent.event) {
          logWarn(
            `[WhatsApp Webhook] Template '${templateEvent.message_template_name}' atualizado na Meta para ${templateEvent.event}`,
          );
          for (const t of store.messageTemplates ?? []) {
            if (t.metaTemplateName === templateEvent.message_template_name) {
              t.metaStatus = templateEvent.event;
            }
          }
        }
      }
    }
  }

  return { statusesProcessed, messagesReceived };
}
