import { NextResponse } from "next/server";
import { runAllBirthdayGreetings } from "@/services/communication/birthdayGreetingsCron";
import { runAllBillingReminders } from "@/services/communication/billingRemindersCron";
import { expireAllDueOnlinePayments, retryAllPendingGatewayCancels } from "@/services/onlinePayments/gateway";
import { reportError } from "@/lib/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finishJobRun, startJobRun } from "@/services/server/backgroundRuns";
import { safeEqual } from "@/lib/security/webhook-signature";

/**
 * Rotina de hora em hora (migracao 34). Pix e links vencidos: expira aqui e
 * cancela no Asaas, que aceita pagamento por ate 12 meses depois do
 * vencimento; tenta de novo os cancelamentos que falharam. Parabens automatico
 * dos espacos com o WhatsApp oficial (doc 19, secao 12). Protegida por CRON_SECRET.
 */
export const runtime = "nodejs";
// Até 5 minutos: muitas chamadas ao Asaas numa rodada.
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (!safeEqual(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  // Uma linha por execucao (job_runs, doc technical/23).
  const admin = createSupabaseAdminClient();
  const runId = await startJobRun(admin, "cron.online-payments");
  const errorReferences: string[] = [];
  const result = { expired: 0, retriedCancels: 0, birthdayGreetings: 0, billingReminders: 0, failures: 0 };
  try {
    result.expired = await expireAllDueOnlinePayments();
  } catch (err) {
    errorReferences.push(await reportError("cron.hourly.expiracao", err, { source: "cron" }));
    result.failures += 1;
  }
  try {
    result.retriedCancels = await retryAllPendingGatewayCancels();
  } catch (err) {
    errorReferences.push(await reportError("cron.hourly.cancelamentos", err, { source: "cron" }));
    result.failures += 1;
  }

  try {
    // Folga para terminar dentro dos 300 s da rota.
    const greetings = await runAllBirthdayGreetings(started + 240_000);
    result.birthdayGreetings = greetings.sent;
    result.failures += greetings.failures;
  } catch (err) {
    errorReferences.push(await reportError("cron.hourly.parabens", err, { source: "cron" }));
    result.failures += 1;
  }

  try {
    const reminders = await runAllBillingReminders(started + 240_000);
    result.billingReminders = reminders.sent;
    result.failures += reminders.failures;
  } catch (err) {
    errorReferences.push(await reportError("cron.hourly.lembretes", err, { source: "cron" }));
    result.failures += 1;
  }

  // Sem espacos contados aqui: as tarefas percorrem os codigos e mensagens de todos.
  await finishJobRun(admin, runId, { organizations: 0, failures: result.failures, totals: result, errorReferences });
  console.info("[cron:online-payments]", JSON.stringify(result));
  return NextResponse.json(result);
}
