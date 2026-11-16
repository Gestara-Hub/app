import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reportError, dbError } from "@/lib/log";
import { sendErrorDigestEmail, type ErrorDigestItem } from "@/lib/email/ses";

/**
 * Resumo diario dos erros por e-mail (doc technical/21), na rotina diaria:
 * so os erros novos ou que voltaram desde o ultimo resumo. Sem
 * `ERROR_DIGEST_EMAIL`, nao envia. Modulo so do servidor.
 */

const MAX_ITEMS = 30;

export async function sendDailyErrorDigest(): Promise<{ errors: number; sent: boolean }> {
  const to = process.env.ERROR_DIGEST_EMAIL?.trim();
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Novos ou que aconteceram de novo depois do ultimo aviso.
  const { data, error } = await admin
    .from("error_logs")
    .select("id, event, message, count, level, source, first_seen, last_seen, last_reference, organization_id, notified_at")
    .gte("last_seen", since)
    .order("count", { ascending: false })
    .limit(500);
  if (error) throw dbError(`resumo de erros: leitura`, error);
  const pending = (data ?? []).filter((row) => !row.notified_at || row.last_seen > row.notified_at);
  if (pending.length === 0 || !to) return { errors: pending.length, sent: false };

  const rows: ErrorDigestItem[] = pending.slice(0, MAX_ITEMS).map((row) => ({
    event: String(row.event),
    message: String(row.message),
    count: Number(row.count),
    level: String(row.level),
    source: String(row.source),
    last_seen: String(row.last_seen),
    last_reference: row.last_reference ? String(row.last_reference) : null,
    organization_id: row.organization_id ? String(row.organization_id) : null,
    isNew: !row.notified_at,
  }));
  const result = await sendErrorDigestEmail({ toEmail: to, rows, total: pending.length });
  if (!result.ok) {
    await reportError("cron.daily.resumo-erros", new Error(result.error), { source: "cron", level: "warn" });
    return { errors: pending.length, sent: false };
  }
  // "Avisado" = o `last_seen` que o aviso cobriu (relogio do banco), nunca a hora do servidor: com
  // alguns ms de diferenca entre os dois relogios, um erro visto logo antes do resumo voltava como novo.
  // `.eq("last_seen", ...)`: se o erro voltou a acontecer no meio do envio, continua pendente.
  for (let i = 0; i < pending.length; i += 25) {
    await Promise.all(
      pending.slice(i, i + 25).map((row) =>
        admin.from("error_logs").update({ notified_at: row.last_seen }).eq("id", row.id).eq("last_seen", row.last_seen),
      ),
    );
  }
  return { errors: pending.length, sent: true };
}
