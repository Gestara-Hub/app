import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/log";
import { runInWorld } from "@/services/world/runWorld";
import { systemTenantContext } from "@/services/server/systemContext";
import { releaseExpiredReservations } from "./eventRegistrationsService";

/**
 * Rotina de hora em hora (doc product/29 P5): reservas de "vaga so com o
 * pagamento" que venceram sem pagar caem, com as cobrancas e o Pix cancelados.
 * A vaga ja nao contava desde o vencimento (`seatHolders`); aqui a inscricao e
 * a cobranca saem de vez. Devolve quantas reservas cairam.
 */
export async function releaseAllExpiredEventReservations(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("event_registrations")
    .select("organization_id")
    .eq("status", "reserved")
    .lt("hold_until", new Date().toISOString())
    .limit(5000);
  if (error) throw error;
  const organizations = [...new Set((data ?? []).map((row) => String(row.organization_id)))];
  let released = 0;
  for (const organizationId of organizations) {
    try {
      const ctx = await systemTenantContext(organizationId, "Rotina de pagamentos online");
      released += await runInWorld(ctx, async () => releaseExpiredReservations());
    } catch (err) {
      await reportError("cron.hourly.reservas-de-evento", err, { source: "cron", context: { organizationId } });
    }
  }
  return released;
}
