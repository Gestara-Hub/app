import { NextResponse } from "next/server";
import { expireAllDueOnlinePayments, retryAllPendingGatewayCancels } from "@/services/onlinePayments/gateway";

/**
 * Pix e links vencidos, de hora em hora (migracao 34): expira aqui e cancela no
 * Asaas, que aceita pagamento por ate 12 meses depois do vencimento. Tambem
 * tenta de novo os cancelamentos que falharam. Protegida por CRON_SECRET.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = { expired: 0, retriedCancels: 0, failures: 0 };
  try {
    result.expired = await expireAllDueOnlinePayments();
  } catch (err) {
    console.error("[cron:online-payments] Expiração falhou:", err);
    result.failures += 1;
  }
  try {
    result.retriedCancels = await retryAllPendingGatewayCancels();
  } catch (err) {
    console.error("[cron:online-payments] Nova tentativa de cancelamento falhou:", err);
    result.failures += 1;
  }

  console.info("[cron:online-payments]", JSON.stringify(result));
  return NextResponse.json(result);
}
