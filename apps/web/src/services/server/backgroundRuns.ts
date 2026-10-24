import type { SupabaseClient } from "@supabase/supabase-js";
import { logWarn } from "@/lib/log";

/**
 * Registro tecnico do que roda em segundo plano (doc technical/23): uma linha
 * por execucao de rotina (`job_runs`) e por aviso do Asaas (`webhook_events`).
 * Responde "a rotina rodou?", "o aviso chegou?", "o que deu errado?". Falha ao
 * registrar nunca derruba a tarefa. Retencao de 120 dias. Modulo so do servidor.
 */

const UNIQUE_VIOLATION = "23505";

export type JobName = "cron.daily" | "cron.online-payments";

export async function startJobRun(admin: SupabaseClient, job: JobName): Promise<string | undefined> {
  try {
    const { data, error } = await admin.from("job_runs").insert({ job }).select("id").single();
    if (error) throw error;
    return String(data.id);
  } catch (error) {
    logWarn("[backgroundRuns] Execução da rotina não registrada:", { job, error });
    return undefined;
  }
}

export interface JobRunResult {
  organizations: number;
  failures: number;
  totals: Record<string, unknown>;
  errorReferences: string[];
}

export async function finishJobRun(admin: SupabaseClient, id: string | undefined, result: JobRunResult): Promise<void> {
  if (!id) return;
  const status = result.failures === 0 ? "ok" : result.failures >= result.organizations && result.organizations > 0 ? "failed" : "partial";
  try {
    const { error } = await admin
      .from("job_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        organizations: result.organizations,
        failures: result.failures,
        totals: result.totals,
        error_references: result.errorReferences.slice(0, 200),
      })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    logWarn("[backgroundRuns] Fim da rotina não registrado:", { id, error });
  }
}

export interface WebhookEventStart {
  /** Linha do aviso (para gravar o resultado). */
  id?: string;
  /** O mesmo aviso ja foi tratado: responder sem tratar de novo. */
  duplicate: boolean;
}

/**
 * Registra o aviso ao chegar. O id do evento no parceiro e unico: o mesmo
 * aviso repetido (o Asaas manda "pelo menos uma vez") volta como `duplicate`
 * se ja foi tratado; se tinha falhado, e tratado de novo.
 */
export async function beginWebhookEvent(
  admin: SupabaseClient,
  input: { eventId?: string; event: string; paymentId?: string; subscriptionId?: string },
): Promise<WebhookEventStart> {
  try {
    const row = {
      event_id: input.eventId ?? null,
      event: input.event,
      payment_id: input.paymentId ?? null,
      subscription_id: input.subscriptionId ?? null,
    };
    const { data, error } = await admin.from("webhook_events").insert(row).select("id").single();
    if (!error) return { id: String(data.id), duplicate: false };
    if (error.code !== UNIQUE_VIOLATION || !input.eventId) throw error;

    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, status, attempts")
      .eq("provider", "asaas")
      .eq("event_id", input.eventId)
      .maybeSingle();
    if (!existing) return { duplicate: false };
    if (existing.status === "processed" || existing.status === "ignored") {
      return { id: String(existing.id), duplicate: true };
    }
    await admin
      .from("webhook_events")
      .update({ attempts: Number(existing.attempts ?? 1) + 1, status: "received" })
      .eq("id", existing.id);
    return { id: String(existing.id), duplicate: false };
  } catch (error) {
    logWarn("[backgroundRuns] Aviso do parceiro não registrado:", { event: input.event, error });
    return { duplicate: false };
  }
}

export async function finishWebhookEvent(
  admin: SupabaseClient,
  id: string | undefined,
  result: { status: "processed" | "ignored" | "failed"; organizationId?: string; outcome?: string; errorReference?: string },
): Promise<void> {
  if (!id) return;
  try {
    const { error } = await admin
      .from("webhook_events")
      .update({
        status: result.status,
        processed_at: new Date().toISOString(),
        ...(result.organizationId ? { organization_id: result.organizationId } : {}),
        outcome: result.outcome ?? null,
        error_reference: result.errorReference ?? null,
      })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    logWarn("[backgroundRuns] Resultado do aviso não registrado:", { id, error });
  }
}
