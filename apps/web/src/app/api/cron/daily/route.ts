import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/concurrency";
import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finishJobRun, startJobRun } from "@/services/server/backgroundRuns";
import { runDailySpaceTasks, type DailySpaceTotals } from "@/services/server/dailyRoutine";
import { reportError } from "@/lib/log";
import { sendDailyErrorDigest } from "@/services/server/errorDigest";
import { runPlanDailyTasks } from "@/services/server/subscriptionPlan";
import { safeEqual } from "@/lib/security/webhook-signature";
import { cleanupUnusedAttachments } from "@/services/attachments/attachmentsCleanup";
import { keepSpaceApiKeyAlive } from "@/services/onlinePayments/apiKeyHealth";

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
  if (!safeEqual(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  // Uma linha por execucao (job_runs, doc technical/23): "a rotina rodou? como foi?".
  const runId = await startJobRun(admin, "cron.daily");
  const { data: orgs, error } = await selectAllRows(() =>
    admin.from("organizations").select("id").eq("model", "classes").eq("status", "active"),
  );
  if (error) {
    const reference = await reportError("cron.daily", error, { source: "cron", context: { step: "listar espaços" } });
    await finishJobRun(admin, runId, { organizations: 0, failures: 1, totals: {}, errorReferences: [reference] });
    return NextResponse.json({ error: "Erro ao listar os espaços." }, { status: 500 });
  }

  const totals: DailySpaceTotals = { membershipCharges: 0, recurrenceEntries: 0, failures: 0, errorReferences: [] };
  const result: Record<string, unknown> & { organizations: number; skipped: number } = { organizations: orgs.length, skipped: 0 };
  // Ordem embaralhada: se o tempo acabar, os que ficaram de fora nao sao sempre os mesmos
  // (a tarefa e idempotente; a proxima rodada pega quem faltou).
  const shuffled = [...orgs].sort(() => Math.random() - 0.5);
  const deadline = Date.now() + BUDGET_MS;
  // Uma tarefa ou um espaco com problema nao impede os outros; o dia seguinte tenta de novo.
  // O que foi criado (ou falhou) sai resumido por espaco na Auditoria.
  const run = await mapWithConcurrency(shuffled, CONCURRENCY, (org) => runDailySpaceTasks(admin, String(org.id), totals), {
    deadline,
  });
  result.skipped = run.skipped;

  // Plano GestaraHub de todos os espacos (doc product/13 §6).
  try {
    const plan = await runPlanDailyTasks(admin, process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin);
    Object.assign(result, { plan });
    totals.failures += plan.failures;
    totals.errorReferences.push(...plan.errorReferences);
  } catch (err) {
    totals.errorReferences.push(await reportError("cron.daily.plano", err, { source: "cron" }));
    totals.failures += 1;
  }

  // Chave de API das subcontas (27/11/2026, doc product/19): uso semanal para o
  // Asaas nao expirar a chave parada; recusada vira "chave invalida" e alerta.
  try {
    const { data: gatewayOrgs, error: gatewayError } = await selectAllRows(() =>
      admin.from("organizations").select("id").eq("status", "active").not("gateway_api_key", "is", null),
    );
    if (gatewayError) throw gatewayError;
    const keys = { alive: 0, invalid: 0, failed: 0, skipped: 0 };
    await mapWithConcurrency(
      gatewayOrgs,
      CONCURRENCY,
      async (org) => {
        keys[await keepSpaceApiKeyAlive(admin, String(org.id))] += 1;
      },
      { deadline: Date.now() + 30_000 },
    );
    Object.assign(result, { subaccountKeys: keys });
  } catch (err) {
    totals.errorReferences.push(await reportError("cron.daily.chaves-das-subcontas", err, { source: "cron" }));
    totals.failures += 1;
  }

  // Anexos sem uso ha mais de 24 horas: formulario cancelado ou aba fechada
  // depois do envio (migracao 86). O que algum registro usa nunca sai.
  try {
    const attachments = await cleanupUnusedAttachments(admin);
    Object.assign(result, { unusedAttachmentsRemoved: attachments.removed });
  } catch (err) {
    totals.errorReferences.push(await reportError("cron.daily.anexos-sem-uso", err, { source: "cron" }));
    totals.failures += 1;
  }

  // Resumo dos erros novos ou que voltaram (doc technical/21).
  try {
    const digest = await sendDailyErrorDigest();
    Object.assign(result, { errorDigest: digest });
  } catch (err) {
    totals.errorReferences.push(await reportError("cron.daily.resumo-erros", err, { source: "cron" }));
  }

  const { errorReferences, ...counts } = totals;
  Object.assign(result, counts);
  await finishJobRun(admin, runId, { organizations: orgs.length, failures: totals.failures, totals: result, errorReferences });
  console.info("[cron:daily]", JSON.stringify(result));
  return NextResponse.json(result);
}
