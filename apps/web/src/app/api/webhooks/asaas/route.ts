import { linkMethodFromAsaasBillingType } from "@gestarahub/core/payment-fees";
import { after, NextResponse } from "next/server";
import type { AsaasWebhookPayload } from "@/lib/asaas";
import {
  markOnlinePaymentPaidInDb,
  expireOnlinePaymentInDb,
  cancelOnlinePaymentByGatewayIdInDb,
} from "@/services/onlinePaymentsBackend";
import { recheckFeesAfterPayment } from "@/services/gatewayAccountBackend";

/**
 * O Asaas manda a data do pagamento sem hora ("2026-10-21"). Guardada como esta,
 * vira meia-noite UTC e aparece como 21h do dia anterior no Brasil. Hoje: a hora
 * em que o aviso chegou. Outro dia: meio-dia no horario de Brasilia.
 */
function paidAtFromAsaas(value: string | undefined | null): string {
  const now = new Date();
  if (!value) return now.toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value).toISOString();
  const todayInBrazil = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return value === todayInBrazil ? now.toISOString() : new Date(`${value}T12:00:00-03:00`).toISOString();
}

export async function POST(req: Request) {
  try {
    // 1. Token do webhook: o Asaas manda em "asaas-access-token" o authToken
    //    cadastrado na subconta (ASAAS_WEBHOOK_SECRET). Sem o cabecalho, recusa
    //    tambem (antes um pedido sem cabecalho passava).
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const headerToken = req.headers.get("asaas-access-token");
      if (headerToken !== webhookSecret) {
        console.warn("[Asaas Webhook] Token de autenticação ausente ou inválido.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("[Asaas Webhook] ASAAS_WEBHOOK_SECRET não configurada; recusando.");
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
      const paidAt = paidAtFromAsaas(payment.clientPaymentDate || payment.paymentDate);
      // netValue ja vem sem a tarifa do Asaas; billingType diz se foi credito ou debito.
      const netValue = Number(payment.netValue);
      const result = await markOnlinePaymentPaidInDb(payment.id, paidAt, "asaas", {
        netValueCents: Number.isFinite(netValue) ? Math.round(netValue * 100) : undefined,
        paidMethod: linkMethodFromAsaasBillingType(payment.billingType),
      });

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
            }).catch((err) => console.error("[Asaas Webhook] Erro ao conferir as tarifas:", err)),
          );
        }
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
