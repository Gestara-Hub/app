import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { nowIso } from "@/services/world/ops";
import { setQueuedMessageDeliverer, type QueuedMessageJob } from "./communicationRules";
import { whatsappClient } from "./whatsappClient";

/**
 * Entrega de uma mensagem "Na fila" (01/11/2026): a chamada a Meta leva
 * segundos e as chamadas de uma aba ao servidor rodam uma por vez (doc 19),
 * entao ela sai do caminho da tela. Roda como efeito depois da gravacao e da
 * resposta (`runWorld`) e grava o resultado direto na linha do registro: o id
 * vira o da Meta (os avisos de entregue e lida chegam por ele, como no envio
 * antigo), ou o registro fica "Falhou" com o motivo, para reenviar no Historico.
 */
export async function deliverQueuedMessage(job: QueuedMessageJob): Promise<void> {
  const admin = createSupabaseAdminClient();
  try {
    const res = await whatsappClient.sendTextMessage(job.phone, job.content);
    const metaId = res.messages?.[0]?.id;
    const { error } = await admin
      .from("message_logs")
      .update({ ...(metaId ? { id: metaId } : {}), status: "sent", sent_at: nowIso(), error_reason: null })
      .eq("id", job.logId)
      .eq("organization_id", job.organizationId);
    if (error) logError("[messageDelivery] Mensagem enviada, mas o registro não foi atualizado:", error);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha ao enviar mensagem de WhatsApp.";
    logError("[messageDelivery] Envio pela Meta falhou:", err);
    const { error } = await admin
      .from("message_logs")
      .update({ status: "failed", error_reason: reason })
      .eq("id", job.logId)
      .eq("organization_id", job.organizationId);
    if (error) logError("[messageDelivery] Falha no envio não gravada no registro:", error);
  }
}

setQueuedMessageDeliverer(deliverQueuedMessage);
