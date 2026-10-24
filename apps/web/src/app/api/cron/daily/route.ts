import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/concurrency";
import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { materializeRecurrencesAction } from "@/services/finance/financeBackend";
import { generateMembershipChargesAction } from "@/services/billing/membershipBackend";
import { reportError } from "@/lib/log";
import { sendDailyErrorDigest } from "@/services/server/errorDigest";
import { runPlanDailyTasks } from "@/services/server/subscriptionPlan";

/**
 * Tarefas diarias de todos os espacos de turmas (doc 15, fatia 1), chamadas
 * pelo Supabase Cron (migracoes 26 e 27) para nao depender de alguem abrir o
 * app: mensalidades automaticas e lancamentos das recorrencias do Financeiro.
 * Tambem o Plano GestaraHub: trocas marcadas, tolerancia da renovacao nao paga
 * e avisos por e-mail (doc product/13 §6).
 * Protegida por CRON_SECRET no cabecalho Authorization. Idempotente: rodar
 * duas vezes no dia nao duplica (indices unicos das migracoes 25 e 27).
 */
export const runtime = "nodejs";
// Muitos espacos: ate 5 minutos (o limite da Vercel com Fluid Compute).
export const maxDuration = 300;

/** Espacos processados ao mesmo tempo. */
const CONCURRENCY = 4;
/** Para de comecar espacos novos depois disto (folga para terminar os em andamento). */
const BUDGET_MS = 240_000;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: orgs, error } = await selectAllRows(() =>
    admin.from("organizations").select("id").eq("model", "classes").eq("status", "active"),
  );
  if (error) {
    void reportError("cron.daily", error, { source: "cron", context: { step: "listar espaços" } });
    return NextResponse.json({ error: "Erro ao listar os espaços." }, { status: 500 });
  }

  const result = { organizations: orgs.length, membershipCharges: 0, recurrenceEntries: 0, failures: 0, skipped: 0 };
  // Ordem embaralhada: se o tempo acabar, os que ficaram de fora nao sao sempre os mesmos
  // (a tarefa e idempotente; a proxima rodada pega quem faltou).
  const shuffled = [...orgs].sort(() => Math.random() - 0.5);
  const deadline = Date.now() + BUDGET_MS;
  const run = await mapWithConcurrency(shuffled, CONCURRENCY, async (org) => {
    const id = String(org.id);
    // Uma tarefa ou um espaco com problema nao impede os outros; o dia seguinte tenta de novo.
    try {
      result.membershipCharges += await generateMembershipChargesAction(id);
    } catch (err) {
      await reportError("cron.daily.mensalidades", err, { source: "cron", organizationId: id });
      result.failures += 1;
    }
    try {
      result.recurrenceEntries += await materializeRecurrencesAction(id);
    } catch (err) {
      await reportError("cron.daily.recorrencias", err, { source: "cron", organizationId: id });
      result.failures += 1;
    }
  }, { deadline });
  result.skipped = run.skipped;

  // Plano GestaraHub de todos os espacos (doc product/13 §6).
  try {
    const plan = await runPlanDailyTasks(admin, process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin);
    Object.assign(result, { plan });
  } catch (err) {
    await reportError("cron.daily.plano", err, { source: "cron" });
    result.failures += 1;
  }

  // Resumo dos erros novos ou que voltaram (doc technical/21).
  try {
    const digest = await sendDailyErrorDigest();
    Object.assign(result, { errorDigest: digest });
  } catch (err) {
    await reportError("cron.daily.resumo-erros", err, { source: "cron" });
  }

  console.info("[cron:daily]", JSON.stringify(result));
  return NextResponse.json(result);
}
