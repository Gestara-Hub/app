import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { nowIso } from "@/services/world/ops";
import { TRANSIENT_SEND_FAILURE_REASON, setQueuedMessageDeliverer, type QueuedMessageJob } from "./communicationRules";
import { WhatsAppApiError } from "@/lib/whatsapp";
import { metaErrorReason, sendOfficial, whatsappClient } from "./whatsappClient";

/**
 * Codigos da Meta que passam sozinhos: erro temporario, servico indisponivel e
 * limite de envio. Os definitivos (conta sem pagamento, fora da janela de 24
 * horas, modelo recusado) nao repetem.
 */
const TRANSIENT_META_CODES = new Set([1, 2, 4, 131000, 131016, 130429]);

/** Esperas entre as tentativas de envio pela Meta. */
export const WHATSAPP_RETRY_DELAYS_MS: number[] = [2000, 5000];

/**
 * Falha passageira: codigo temporario da Meta ou falha de rede antes da
 * resposta. Tempo esgotado nao repete: a Meta pode ter enviado e o aluno
 * receberia duas vezes.
 */
export function isTransientWhatsAppFailure(err: unknown): boolean {
  if (err instanceof WhatsAppApiError) return TRANSIENT_META_CODES.has(err.code);
  return err instanceof TypeError;
}

/** Envio pela Meta com nova tentativa nas falhas passageiras. */
async function sendWithRetry(...args: Parameters<typeof sendOfficial>): ReturnType<typeof sendOfficial> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendOfficial(...args);
    } catch (err) {
      if (attempt >= WHATSAPP_RETRY_DELAYS_MS.length || !isTransientWhatsAppFailure(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, WHATSAPP_RETRY_DELAYS_MS[attempt]));
    }
  }
}

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
    // Sempre pelo numero do proprio espaco (doc technical/07 §1.1).
    const config = await whatsappClient.configFor(job.organizationId);
    if (!config) throw new Error("O WhatsApp oficial do espaço não está conectado.");
    const res = await sendWithRetry(job.phone, job.content, job.template, config);
    const metaId = res.messages?.[0]?.id;
    const { error } = await admin
      .from("message_logs")
      .update({ ...(metaId ? { id: metaId } : {}), status: "sent", sent_at: nowIso(), error_reason: null })
      .eq("id", job.logId)
      .eq("organization_id", job.organizationId);
    if (error) logError("[messageDelivery] Mensagem enviada, mas o registro não foi atualizado:", error);
  } catch (err) {
    // Passageira mesmo depois das novas tentativas: o lembrete automatico volta
    // na proxima rodada (reminderAlreadyHandled); a mensagem avulsa reenvia no Historico.
    const reason = isTransientWhatsAppFailure(err) ? TRANSIENT_SEND_FAILURE_REASON : metaErrorReason(err);
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
