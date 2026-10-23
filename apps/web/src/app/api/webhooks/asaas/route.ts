import { after, NextResponse } from "next/server";
import type { AsaasWebhookPayload } from "@/lib/asaas";
import { settleAsaasPayment } from "@/services/onlinePayments/asaasSettlement";
import {
  expireOnlinePaymentInDb,
  cancelOnlinePaymentByGatewayIdInDb,
} from "@/services/onlinePayments/onlinePaymentsWebhook";
import { recheckFeesAfterPayment } from "@/services/onlinePayments/gateway";
import { logError, logWarn, reportError } from "@/lib/log";

export async function POST(req: Request) {
  try {
    // 1. Token do webhook: o Asaas manda em "asaas-access-token" o authToken
    //    cadastrado na subconta (ASAAS_WEBHOOK_SECRET). Sem o cabecalho, recusa
    //    tambem (antes um pedido sem cabecalho passava).
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const headerToken = req.headers.get("asaas-access-token");
      if (headerToken !== webhookSecret) {
        logWarn("[Asaas Webhook] Token de autenticação ausente ou inválido.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      logError("[Asaas Webhook] ASAAS_WEBHOOK_SECRET não configurada; recusando.");
      return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
    }

    const payload = (await req.json()) as AsaasWebhookPayload;
    const { event, payment } = payload ?? {};

    if (!event || !payment?.id) {
      return NextResponse.json(
        { error: "Payload inválido. 'event' e 'payment.id' são obrigatórios." },
        { status: 400 },
      );
    }

    console.log(
      `[Asaas Webhook] Evento recebido: ${event} para o pagamento ${payment.id}`,
    );

    // 2. Trata eventos de liquidação / confirmação de pagamento
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      // CONFIRMED: pago, saldo ainda nao liberado (cartao ~32 dias). RECEIVED: disponivel.
      const result = await settleAsaasPayment(payment, event === "PAYMENT_RECEIVED");

      if (result) {
        // Tarifa real diferente da tabela gravada: a tarifa da subconta mudou.
        const paid = result.payment;
        if (paid.organizationId) {
          after(() =>
            recheckFeesAfterPayment({
              organizationId: paid.organizationId!,
              paidMethod: paid.paidMethod,
              chargedCents: paid.amountCents,
              realFeeCents: paid.gatewayFeeCents,
            }).catch((err) => logError("[Asaas Webhook] Erro ao conferir as tarifas:", err)),
          );
        }
        console.log(
          `[Asaas Webhook] Pagamento online e cobrança ${result.chargeId} marcados como pagos via Asaas!`,
        );
      } else {
        logWarn(
          `[Asaas Webhook] Pagamento ${payment.id} não encontrado na base local do GestaraHub.`,
        );
      }

      return NextResponse.json({ success: true, processed: Boolean(result) });
    }

    // 3. Trata vencimento ou cancelamento
    if (event === "PAYMENT_OVERDUE") {
      await expireOnlinePaymentInDb(payment.id, "asaas");
      return NextResponse.json({ success: true, status: "expired" });
    }

    if (event === "PAYMENT_DELETED") {
      await cancelOnlinePaymentByGatewayIdInDb(payment.id, "asaas");
      return NextResponse.json({ success: true, status: "canceled" });
    }

    // Outros eventos (ex: PAYMENT_CREATED) são reconhecidos sem erro
    return NextResponse.json({ success: true, ignored: true });
  } catch (error) {
    await reportError("webhook.asaas", error, { source: "webhook" });
    return NextResponse.json(
      { error: "Erro interno ao processar webhook." },
      { status: 500 },
    );
  }
}
