import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MetaTemplateStatus,
  WhatsAppTemplateStatusValue,
  WhatsAppWebhookPayload,
  WhatsAppWebhookStatus,
  WhatsAppWebhookValue,
} from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/log";
import { applyWhatsAppOptOut, isOptOutText } from "./whatsappOptOut";

/**
 * Avisos da Meta (doc technical/07 §1.4). Cada aviso chega pela conta do
 * espaco: o numero (`phone_number_id`) diz de qual espaco sao os status de
 * entrega e as respostas; a conta (`waba_id`) diz de quem e o modelo.
 */

const TEMPLATE_STATUSES: readonly MetaTemplateStatus[] = ["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"];

function adminClient(): SupabaseClient | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    // Sem banco (demonstracao): nada a gravar.
    return null;
  }
}

/** Espaco dono do numero que recebeu o aviso (credenciais do proprio numero). */
async function organizationByPhoneNumberId(admin: SupabaseClient, phoneNumberId: string | undefined): Promise<string | null> {
  if (!phoneNumberId) return null;
  const { data } = await admin
    .from("whatsapp_credentials")
    .select("organization_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return data ? String(data.organization_id) : null;
}

/**
 * Atualiza a entrega e a leitura de uma mensagem enviada. Com o espaco
 * conhecido, so a mensagem dele (o id da Meta nao se repete, mas o filtro
 * nao custa).
 */
export async function processWhatsAppStatusUpdate(
  status: WhatsAppWebhookStatus,
  organizationId?: string | null,
  admin: SupabaseClient | null = adminClient(),
): Promise<void> {
  const wamid = status.id;
  const mappedStatus = status.status;
  const timestampIso = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const errorReason =
    status.status === "failed"
      ? status.errors?.[0]?.message || status.errors?.[0]?.title || "Falha na entrega"
      : undefined;

  // O aviso chega fora de um espaco carregado: grava direto no banco (o gatilho
  // do banco sobe a versao do espaco, e a proxima leitura ja ve).
  if (admin) {
    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (mappedStatus === "read") updateData.read_at = timestampIso;
    if (errorReason) updateData.error_reason = errorReason;
    let query = admin.from("message_logs").update(updateData).eq("id", wamid);
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { error } = await query;
    if (error) logWarn(`[WhatsApp Webhook] Erro ao atualizar status no banco para ${wamid}:`, error);
  }
}

/**
 * Situacao nova de um modelo (aprovado, recusado, pausado, desativado): grava
 * no modelo dos espacos daquela conta. Antes so mudava a memoria do servidor.
 */
export async function processTemplateStatusUpdate(
  wabaId: string,
  value: WhatsAppTemplateStatusValue,
  admin: SupabaseClient | null = adminClient(),
): Promise<number> {
  const name = value.message_template_name;
  const event = String(value.event ?? "").toUpperCase() as MetaTemplateStatus;
  if (!name || !TEMPLATE_STATUSES.includes(event)) return 0;
  if (value.message_template_language && value.message_template_language !== "pt_BR") return 0;
  const reason = event === "REJECTED" && value.reason && value.reason !== "NONE" ? value.reason : null;

  if (!admin) return 0;

  const { data: owners } = await admin.from("whatsapp_credentials").select("organization_id").eq("waba_id", wabaId);
  const organizations = (owners ?? []).map((row) => String(row.organization_id));
  if (organizations.length === 0) return 0;
  const { data, error } = await admin
    .from("message_templates")
    .update({ meta_status: event, meta_rejection_reason: reason })
    .in("organization_id", organizations)
    .eq("meta_template_name", name)
    .select("id");
  if (error) {
    logWarn(`[WhatsApp Webhook] Situação do modelo ${name} não gravada:`, error);
    return 0;
  }
  return data?.length ?? 0;
}

async function processMessagesChange(
  admin: SupabaseClient | null,
  value: WhatsAppWebhookValue,
  counters: { statusesProcessed: number; messagesReceived: number },
): Promise<void> {
  const organizationId = admin ? await organizationByPhoneNumberId(admin, value.metadata?.phone_number_id) : null;

  // 1. Entrega, leitura e falha.
  for (const status of value.statuses ?? []) {
    try {
      await processWhatsAppStatusUpdate(status, organizationId, admin);
      counters.statusesProcessed += 1;
    } catch (err) {
      logError("[WhatsApp Webhook] Erro ao processar atualização de status:", err);
    }
  }

  // 2. Respostas dos alunos. "SAIR", "PARAR" ou "CANCELAR" param o envio
  // oficial do espaco (doc product/27 M2).
  const messages = value.messages ?? [];
  counters.messagesReceived += messages.length;
  if (!admin) return;
  for (const message of messages) {
    if (message.type !== "text" || !isOptOutText(message.text?.body)) continue;
    try {
      await applyWhatsAppOptOut(admin, {
        from: message.from,
        organizationId,
        businessNumber: value.metadata?.display_phone_number,
      });
    } catch (err) {
      logError("[WhatsApp Webhook] Erro ao registrar o pedido para parar:", err);
    }
  }
}

/** Processa um aviso completo da Meta. */
export async function handleWhatsAppWebhookPayload(payload: WhatsAppWebhookPayload): Promise<{
  statusesProcessed: number;
  messagesReceived: number;
  templatesUpdated: number;
}> {
  const counters = { statusesProcessed: 0, messagesReceived: 0, templatesUpdated: 0 };
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return counters;
  const admin = adminClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (!change?.value) continue;
      if (change.field === "messages") {
        await processMessagesChange(admin, change.value as WhatsAppWebhookValue, counters);
      } else if (change.field === "message_template_status_update") {
        counters.templatesUpdated += await processTemplateStatusUpdate(
          String(entry.id),
          change.value as WhatsAppTemplateStatusValue,
          admin,
        );
      }
    }
  }
  return counters;
}
