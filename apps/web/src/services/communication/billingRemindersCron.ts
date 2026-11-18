import { mapWithConcurrency } from "@/lib/concurrency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { TenantContext } from "../server/tenant";
import type { MethodSlice } from "../world/slices";
import { runInWorld } from "../world/runWorld";
import { runBillingReminders } from "./communicationRules";
import { reportError, dbError } from "@/lib/log";

/** Recorte: cobranças, pagamentos online, turmas, alunos, modelos e lembretes já registrados. */
export const billingRemindersSlice: MethodSlice = async (_args, load) => {
  await Promise.all([
    load.all("charges"),
    load.all("onlinePayments"),
    load.all("classGroups"),
    load.all("clients"),
    load.all("messageTemplates"),
    load.where("messageLogs", "category", ["billing"]),
  ]);
};

const CONCURRENCY = 4;

/** Contexto de servidor do espaco (dono), para gravacoes fora de uma requisicao. */
export async function cronContext(organizationId: string): Promise<TenantContext | null> {
  const admin = createSupabaseAdminClient();
  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner) return null;
  return {
    client: admin,
    organizationId,
    userId: String(owner.id),
    profile: "owner",
    require: () => undefined,
  } as unknown as TenantContext;
}

/** Executa os lembretes de cobrança automáticos de um espaço. */
export async function runBillingRemindersFor(organizationId: string): Promise<number> {
  const ctx = await cronContext(organizationId);
  if (!ctx) return 0;
  return runInWorld(ctx, async () => runBillingReminders(), {
    fn: billingRemindersSlice,
    args: [],
    name: "cron.billingReminders",
  });
}

/** Executa os lembretes para todos os espaços com WhatsApp oficial conectado. */
export async function runAllBillingReminders(
  deadline: number,
): Promise<{ sent: number; failures: number; skipped: number }> {
  const admin = createSupabaseAdminClient();
  const { data: connections, error } = await selectAllRows(
    () => admin.from("whatsapp_connections").select("organization_id").eq("official_status", "connected"),
    { tieBreaker: "organization_id" },
  );
  if (error) throw dbError("lembretes de cobrança: leitura das conexões", error);
  const result = { sent: 0, failures: 0, skipped: 0 };
  const run = await mapWithConcurrency(
    connections,
    CONCURRENCY,
    async (row) => {
      try {
        result.sent += await runBillingRemindersFor(String(row.organization_id));
      } catch (err) {
        await reportError("cron.hourly.lembretes", err, {
          source: "cron",
          organizationId: String(row.organization_id),
        });
        result.failures += 1;
      }
    },
    { deadline },
  );
  result.skipped = run.skipped;
  return result;
}
