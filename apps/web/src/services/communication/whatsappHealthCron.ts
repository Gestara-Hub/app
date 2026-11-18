import { mapWithConcurrency } from "@/lib/concurrency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAllRows } from "@/lib/supabase/select-all";
import { dbError, reportError } from "@/lib/log";
import { whatsappCredentialsGateway } from "./whatsappCredentials";

/**
 * Situacao na Meta de todos os espacos com o WhatsApp oficial conectado, de
 * hora em hora (doc technical/07 §1.6): o bloqueio por falta de pagamento, o
 * nome em analise e o limite diario aparecem na Conexao e no sino sem a pessoa
 * precisar abrir a Meta. Uma consulta por espaco, gravada direto na conexao.
 */

const CONCURRENCY = 4;

export async function refreshAllMetaHealth(
  deadline: number,
): Promise<{ checked: number; blocked: number; failures: number; skipped: number }> {
  const admin = createSupabaseAdminClient();
  const { data: connections, error } = await selectAllRows(
    () => admin.from("whatsapp_connections").select("organization_id").eq("official_status", "connected"),
    { tieBreaker: "organization_id" },
  );
  if (error) throw dbError("situação na Meta: leitura das conexões", error);
  const result = { checked: 0, blocked: 0, failures: 0, skipped: 0 };
  const run = await mapWithConcurrency(
    connections,
    CONCURRENCY,
    async (row) => {
      try {
        const health = await whatsappCredentialsGateway.refreshHealth(String(row.organization_id));
        if (!health) return;
        result.checked += 1;
        if (health.sendState === "blocked") result.blocked += 1;
      } catch (err) {
        await reportError("cron.hourly.situacao-meta", err, { source: "cron", organizationId: String(row.organization_id) });
        result.failures += 1;
      }
    },
    { deadline },
  );
  result.skipped = run.skipped;
  return result;
}
