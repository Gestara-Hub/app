import { after, NextResponse } from "next/server";
import { AsaasApiError, type AsaasPaymentResponse, type AsaasWebhookPayload } from "@/lib/asaas";
import { decodePlanChangeReference } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  recordPlanChangePaymentPaid,
  recordSubscriptionPaymentOpen,
  recordSubscriptionPaymentPaid,
  recordSubscriptionRemoved,
} from "@/services/server/subscriptionPlan";
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
    const { event, payment, subscription } = payload ?? {};

    // Assinatura do Plano GestaraHub encerrada direto no Asaas (doc product/13 §6).
    if (event?.startsWith("SUBSCRIPTION_")) {
      const removed =
        (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") && subscription?.id
          ? await recordSubscriptionRemoved(createSupabaseAdminClient(), subscription)
          : false;
      return NextResponse.json({ success: true, processed: removed });
    }

    if (!event || !payment?.id) {
      return NextResponse.json(
        { error: "Payload inválido. 'event' e 'payment.id' são obrigatórios." },
        { status: 400 },
      );
    }

    console.log(
      `[Asaas Webhook] Evento recebido: ${event} para o pagamento ${payment.id}`,
    );

    // Cobrancas do Plano GestaraHub: renovacao da assinatura ou diferenca de um upgrade.
    const plan = await handlePlanPayment(event, payment);
    if (plan !== null) return NextResponse.json({ success: true, processed: plan });

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

/**
 * Pagamento do Plano GestaraHub (conta principal): `null` quando nao e do plano
 * (cobranca de aluno numa subconta), para seguir o fluxo de sempre.
 */
async function handlePlanPayment(event: AsaasWebhookPayload["event"], payment: AsaasPaymentResponse): Promise<boolean | null> {
  const admin = createSupabaseAdminClient();
  const paid = event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED";
  if (decodePlanChangeReference(payment.externalReference)) {
    return paid ? recordPlanChangePaymentPaid(admin, payment) : false;
  }
  if (!payment.subscription) return null;
  try {
    if (paid) return Boolean(await recordSubscriptionPaymentPaid(admin, payment));
    if (event === "PAYMENT_CREATED" || event === "PAYMENT_OVERDUE") {
      return recordSubscriptionPaymentOpen(admin, payment, event === "PAYMENT_OVERDUE");
    }
    return false;
  } catch (error) {
    // Assinatura que a conta principal nao conhece (de uma subconta): nao e do plano.
    if (error instanceof AsaasApiError && error.status === 404) return null;
    throw error;
  }
}
