import { mapWithConcurrency } from "@/lib/concurrency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { TenantContext } from "../server/tenant";
import type { MethodSlice } from "../world/slices";
import { runInWorld } from "../world/runWorld";
import { runBirthdayGreetings } from "./communicationRules";
import { reportError } from "@/lib/log";

/**
 * Parabens automatico na rotina de hora em hora (doc 19, secao 12): antes rodava
 * na leitura do historico de mensagens, entao so saia se alguem abrisse a tela
 * depois do horario da regra, e a leitura gravava. Agora cada espaco com o
 * WhatsApp oficial conectado roda a mesma regra uma vez por hora (a regra so
 * envia a partir do horario dela e uma vez por aluno por dia). Modulo so do servidor.
 */

/** Recorte: alunos, modelos e so os parabens ja registrados (para nao repetir no dia). */
export const birthdayGreetingsSlice: MethodSlice = async (_args, load) => {
  await Promise.all([
    load.all("clients"),
    load.all("messageTemplates"),
    load.where("messageLogs", "trigger", ["birthday_greeting"]),
  ]);
};

const CONCURRENCY = 4;

/** Contexto da rotina: o espaco e o dono dele (a regra nao grava auditoria). */
async function cronContext(organizationId: string): Promise<TenantContext | null> {
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

/** Parabens de um espaco; devolve quantos sairam. */
export async function runBirthdayGreetingsFor(organizationId: string): Promise<number> {
  const ctx = await cronContext(organizationId);
  if (!ctx) return 0;
  return runInWorld(ctx, async () => runBirthdayGreetings(), {
    fn: birthdayGreetingsSlice,
    args: [],
    name: "cron.birthdayGreetings",
  });
}

/** Todos os espacos com o WhatsApp oficial conectado. */
export async function runAllBirthdayGreetings(deadline: number): Promise<{ sent: number; failures: number; skipped: number }> {
  const admin = createSupabaseAdminClient();
  const { data: connections, error } = await selectAllRows(
    () => admin.from("whatsapp_connections").select("organization_id").eq("official_status", "connected"),
    { tieBreaker: "organization_id" },
  );
  if (error) throw new Error(`parabéns: leitura das conexões: ${error.message}`);
  const result = { sent: 0, failures: 0, skipped: 0 };
  const run = await mapWithConcurrency(
    connections,
    CONCURRENCY,
    async (row) => {
      try {
        result.sent += await runBirthdayGreetingsFor(String(row.organization_id));
      } catch (err) {
        await reportError("cron.hourly.parabens", err, { source: "cron", organizationId: String(row.organization_id) });
        result.failures += 1;
      }
    },
    { deadline },
  );
  result.skipped = run.skipped;
  return result;
}
