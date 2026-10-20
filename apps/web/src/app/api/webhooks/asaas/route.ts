import { NextResponse } from "next/server";
import type { AsaasWebhookPayload } from "@/lib/asaas";
import {
  markOnlinePaymentPaidInDb,
  expireOnlinePaymentInDb,
  cancelOnlinePaymentByGatewayIdInDb,
} from "@/services/onlinePaymentsBackend";

export async function POST(req: Request) {
  try {
    // 1. Verificação de token de webhook (se configurado no .env)
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerToken = req.headers.get("asaas-access-token");
      if (headerToken && headerToken !== webhookSecret) {
        console.warn("[Asaas Webhook] Token de autenticação inválido.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
      const paidAt =
        payment.clientPaymentDate ||
        payment.paymentDate ||
        new Date().toISOString();
      const result = await markOnlinePaymentPaidInDb(
        payment.id,
        paidAt,
        "asaas",
      );

      if (result) {
        console.log(
          `[Asaas Webhook] Pagamento online e cobrança ${result.chargeId} marcados como pagos via Asaas!`,
        );
      } else {
        console.warn(
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
    console.error("[Asaas Webhook] Erro ao processar webhook:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar webhook." },
      { status: 500 },
    );
  }
}
