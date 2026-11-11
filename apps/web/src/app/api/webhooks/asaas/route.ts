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
  markOnlinePaymentDisputeInDb,
  cancelOnlinePaymentByGatewayIdInDb,
} from "@/services/onlinePayments/onlinePaymentsWebhook";
import { recheckFeesAfterPayment } from "@/services/onlinePayments/gateway";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnlinePaymentDisputeStatus } from "@gestarahub/contracts";
import { logError, logWarn, reportError } from "@/lib/log";
import { beginWebhookEvent, finishWebhookEvent } from "@/services/server/backgroundRuns";
import { auditOnlinePaymentConflict, auditOnlinePaymentDispute, auditOnlinePaymentPaid } from "@/services/onlinePayments/onlinePaymentAudit";
import { safeEqual } from "@/lib/security/webhook-signature";

export async function POST(req: Request) {
  // 1. Token do webhook: o Asaas manda em "asaas-access-token" o authToken
  //    cadastrado na subconta (ASAAS_WEBHOOK_SECRET). Sem o cabecalho, recusa
  //    tambem (antes um pedido sem cabecalho passava).
  const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const headerToken = req.headers.get("asaas-access-token");
    if (!safeEqual(headerToken, webhookSecret)) {
      logWarn("[Asaas Webhook] Token de autenticação ausente ou inválido.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    logError("[Asaas Webhook] ASAAS_WEBHOOK_SECRET não configurada; recusando.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  let payload: (AsaasWebhookPayload & { id?: string }) | null = null;
  try {
    payload = (await req.json()) as AsaasWebhookPayload & { id?: string };
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const { event, payment, subscription } = payload ?? {};
  if (!event || (!payment?.id && !subscription?.id)) {
    return NextResponse.json(
      { error: "Payload inválido. 'event' e 'payment.id' são obrigatórios." },
      { status: 400 },
    );
  }

  // 2. Cada aviso vira uma linha (doc technical/23); o mesmo aviso repetido,
  //    ja tratado, so e reconhecido (o Asaas manda "pelo menos uma vez").
  const admin = createSupabaseAdminClient();
  const record = await beginWebhookEvent(admin, {
    eventId: payload?.id,
    event,
    paymentId: payment?.id,
    subscriptionId: subscription?.id ?? payment?.subscription,
  });
  if (record.duplicate) return NextResponse.json({ success: true, duplicate: true });

  try {
    const handled = await handleEvent(admin, event, payment, subscription);
    await finishWebhookEvent(admin, record.id, handled);
    return NextResponse.json({ success: true, processed: handled.status === "processed" });
  } catch (error) {
    const reference = await reportError("webhook.asaas", error, { source: "webhook", context: { event } });
    await finishWebhookEvent(admin, record.id, { status: "failed", errorReference: reference });
    // 500: o Asaas tenta de novo, e a linha do aviso volta a ser tratada.
    return NextResponse.json({ error: "Erro interno ao processar webhook." }, { status: 500 });
  }
}

type Handled = { status: "processed" | "ignored"; organizationId?: string; outcome: string };

async function handleEvent(
  admin: SupabaseClient,
  event: AsaasWebhookPayload["event"],
  payment: AsaasPaymentResponse | undefined,
  subscription: AsaasWebhookPayload["subscription"],
): Promise<Handled> {
  // Assinatura do Plano GestaraHub encerrada direto no Asaas (doc product/13 §6).
  if (event.startsWith("SUBSCRIPTION_")) {
    const removed =
      (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") && subscription?.id
        ? await recordSubscriptionRemoved(admin, subscription)
        : false;
    return removed ? { status: "processed", outcome: "plano: assinatura removida no parceiro" } : { status: "ignored", outcome: "assinatura" };
  }
  if (!payment) return { status: "ignored", outcome: "sem cobrança" };

  // Cobrancas do Plano GestaraHub: renovacao da assinatura ou diferenca de um upgrade.
  const plan = await handlePlanPayment(event, payment);
  if (plan !== null) return plan ? { status: "processed", outcome: `plano: ${event}` } : { status: "ignored", outcome: `plano: ${event}` };

  // Liquidacao / confirmacao de pagamento de aluno (subconta).
  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    // CONFIRMED: pago, saldo ainda nao liberado (cartao ~32 dias). RECEIVED: disponivel.
    const result = await settleAsaasPayment(payment, event === "PAYMENT_RECEIVED");
    if (!result) {
      logWarn(`[Asaas Webhook] Pagamento ${payment.id} não encontrado na base local do GestaraHub.`);
      return { status: "ignored", outcome: "pagamento não encontrado" };
    }
    const paid = result.payment;
    if (paid.organizationId) {
      // Tarifa real diferente da tabela gravada: a tarifa da subconta mudou.
      after(() =>
        recheckFeesAfterPayment({
          organizationId: paid.organizationId!,
          paidMethod: paid.paidMethod,
          chargedCents: paid.amountCents,
          realFeeCents: paid.gatewayFeeCents,
        }).catch((err) => logError("[Asaas Webhook] Erro ao conferir as tarifas:", err)),
      );
    }
    // Pago depois de a cobranca sair do aberto (codigo antigo, pagamento em dobro):
    // a cobranca fica como estava; aviso ao dono e no registro de erros.
    if (result.conflict) {
      logWarn(
        `[Asaas Webhook] Pagamento ${payment.id} recebido de cobrança que não estava em aberto (${result.conflict}): a cobrança ficou como estava; o dono foi avisado na Auditoria.`,
      );
      await auditOnlinePaymentConflict(admin, paid, result.conflict);
      return { status: "processed", organizationId: paid.organizationId, outcome: `pagamento de aluno: cobrança não estava em aberto (${result.conflict})` };
    }
    // Na Auditoria uma vez por pagamento (o cartao avisa "confirmado" e depois "recebido").
    if (result.newlyPaid) await auditOnlinePaymentPaid(admin, paid);
    return {
      status: "processed",
      organizationId: paid.organizationId,
      outcome: result.newlyPaid ? "pagamento de aluno: baixa da cobrança" : "pagamento de aluno: saldo liberado",
    };
  }

  // Vencimento ou cancelamento do codigo de pagamento.
  if (event === "PAYMENT_OVERDUE") {
    await expireOnlinePaymentInDb(payment.id, "asaas");
    return { status: "processed", outcome: "pagamento de aluno: código vencido" };
  }
  if (event === "PAYMENT_DELETED") {
    await cancelOnlinePaymentByGatewayIdInDb(payment.id, "asaas");
    return { status: "processed", outcome: "pagamento de aluno: código removido" };
  }

  // Estorno e contestacao (doc product/25, urgencia): o app grava o aviso no pagamento
  // e avisa o dono (Auditoria, sino, topo e modal); a cobranca continua paga ate ele decidir.
  const dispute = disputeStatusOf(event);
  if (dispute) {
    const disputed = await markOnlinePaymentDisputeInDb(payment.id, "asaas", dispute);
    if (!disputed) {
      logWarn(`[Asaas Webhook] ${event} no pagamento ${payment.id} sem pagamento pago correspondente no GestaraHub.`);
      return { status: "ignored", outcome: `${event}: pagamento não encontrado` };
    }
    await auditOnlinePaymentDispute(admin, disputed);
    return { status: "processed", organizationId: disputed.organizationId, outcome: `pagamento de aluno: ${dispute} (dono avisado)` };
  }

  // Outros eventos (ex: PAYMENT_CREATED) sao reconhecidos sem erro.
  return { status: "ignored", outcome: event };
}

/** Evento do parceiro -> situacao de estorno ou contestacao gravada no pagamento. */
function disputeStatusOf(event: string): OnlinePaymentDisputeStatus | null {
  switch (event) {
    case "PAYMENT_REFUNDED":
      return "refunded";
    case "PAYMENT_REFUND_IN_PROGRESS":
      return "refund_in_progress";
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return "chargeback_requested";
    case "PAYMENT_CHARGEBACK_DISPUTE":
      return "chargeback_dispute";
    case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL":
      return "chargeback_reversal_pending";
    default:
      return null;
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
