import { NextResponse } from "next/server";
import { runAllBirthdayGreetings } from "@/services/communication/birthdayGreetingsCron";
import { expireAllDueOnlinePayments, retryAllPendingGatewayCancels } from "@/services/onlinePayments/gateway";
import { reportError } from "@/lib/log";

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
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const result = { expired: 0, retriedCancels: 0, birthdayGreetings: 0, failures: 0 };
  try {
    result.expired = await expireAllDueOnlinePayments();
  } catch (err) {
    await reportError("cron.hourly.expiracao", err, { source: "cron" });
    result.failures += 1;
  }
  try {
    result.retriedCancels = await retryAllPendingGatewayCancels();
  } catch (err) {
    await reportError("cron.hourly.cancelamentos", err, { source: "cron" });
    result.failures += 1;
  }

  try {
    // Folga para terminar dentro dos 300 s da rota.
    const greetings = await runAllBirthdayGreetings(started + 240_000);
    result.birthdayGreetings = greetings.sent;
    result.failures += greetings.failures;
  } catch (err) {
    await reportError("cron.hourly.parabens", err, { source: "cron" });
    result.failures += 1;
  }

  console.info("[cron:online-payments]", JSON.stringify(result));
  return NextResponse.json(result);
}
