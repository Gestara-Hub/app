import type { OnlinePayment } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelGatewayPayment, subaccountKeyOf } from "./gateway";
import { chargeMethodOf, mapRowToOnlinePayment } from "./onlinePaymentsRows";
import { logError } from "@/lib/log";

/**
 * Baixa, expiracao e cancelamento vindos do webhook do Asaas (app/api/webhooks).
 * Modulo so do servidor, sem "use server" de proposito (doc 15, fatia 3): como
 * action, qualquer um marcaria um pagamento como pago pelo navegador.
 */

export async function markOnlinePaymentPaidInDb(
  gatewayPaymentId: string,
  paidAtISO: string,
  provider?: string,
  /** Do webhook: valor liquido do Asaas (centavos) e o meio usado. Troca a tarifa estimada pela real. */
  settlement?: {
    netValueCents?: number;
    paidMethod?: OnlinePayment["paidMethod"];
    /** Pago x disponivel: CONFIRMED (released false) e RECEIVED (released true). */
    release?: { released: boolean; creditDate?: string };
    /** Comprovante do parceiro (pagina publica /p/<codigo>). */
    receiptUrl?: string;
  },
): Promise<{
  payment: OnlinePayment;
  chargeId: string;
  newlyPaid: boolean;
  /**
   * Pago, mas a cobranca nao estava mais em aberto: "already_paid" (paga por
   * outro meio ou outro codigo) ou "closed" (cancelada ou isenta). A cobranca
   * fica como estava; o valor recebido vira aviso para o dono.
   */
  conflict?: "already_paid" | "closed";
} | null> {
  const adminClient = createSupabaseAdminClient();

  // Ja estava pago? (cartao: CONFIRMED e depois RECEIVED; aviso repetido)
  let before = adminClient.from("online_payments").select("status").eq("gateway_payment_id", gatewayPaymentId);
  if (provider) before = before.eq("gateway_provider", provider);
  const { data: previous } = await before.maybeSingle();

  const real: Record<string, unknown> = {};
  if (settlement?.paidMethod) real.paid_method = settlement.paidMethod;
  if (settlement?.receiptUrl) real.receipt_url = settlement.receiptUrl;
  if (typeof settlement?.netValueCents === "number") {
    let lookup = adminClient
      .from("online_payments")
      .select("amount_cents, split_amount_cents")
      .eq("gateway_payment_id", gatewayPaymentId);
    if (provider) lookup = lookup.eq("gateway_provider", provider);
    const { data: current } = await lookup.maybeSingle();
    if (current) {
      const amount = Number(current.amount_cents) || 0;
      const split = Number(current.split_amount_cents) || 0;
      // netValue do Asaas ja desconta a tarifa dele; o split sai depois, na liquidacao.
      real.gateway_fee_cents = Math.max(0, amount - settlement.netValueCents);
      real.net_amount_cents = Math.max(0, settlement.netValueCents - split);
    }
  }

  if (settlement?.release) {
    const { released, creditDate } = settlement.release;
    if (released) {
      real.funds_released = true;
      if (creditDate) real.credit_date = creditDate;
    } else {
      // CONFIRMED atrasado (depois do RECEIVED) nao volta o valor para "a liberar".
      let lookup = adminClient
        .from("online_payments")
        .select("funds_released")
        .eq("gateway_payment_id", gatewayPaymentId);
      if (provider) lookup = lookup.eq("gateway_provider", provider);
      const { data: current } = await lookup.maybeSingle();
      if (!current?.funds_released) {
        real.funds_released = false;
        if (creditDate) real.credit_date = creditDate;
      }
    }
  }

  // 1. Atualiza online_payments
  let query = adminClient
    .from("online_payments")
    .update({
      status: "paid",
      paid_at: paidAtISO,
      ...real,
    })
    .eq("gateway_payment_id", gatewayPaymentId);

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { data: updatedPayment, error: paymentError } = await query
    .select()
    .maybeSingle();

  if (paymentError || !updatedPayment) {
    logError(
      "[onlinePaymentsBackend] Erro ao marcar online_payment como pago:",
      paymentError,
    );
    return null;
  }

  const payment = mapRowToOnlinePayment(updatedPayment);

  const newlyPaid = previous?.status !== "paid";
  if (!newlyPaid) return { payment, chargeId: payment.chargeId, newlyPaid };

  // 2. Baixa na cobranca, so se ela ainda esta em aberto (gravacao condicional,
  // sem corrida). Cancelada (troca de plano, inativacao, saida da aula) nao volta
  // a valer ao lado da substituta, e a paga em dinheiro nao vira Pix.
  const { data: settled, error: chargeError } = await adminClient
    .from("charges")
    .update({
      status: "paid",
      // Meio real do webhook; sem ele, pela forma gerada (link e cartao, Pix e Pix, o resto outro).
      method: chargeMethodOf(payment),
      paid_via: "online",
      paid_at: paidAtISO,
    })
    .eq("id", payment.chargeId)
    .in("status", ["pending", "overdue"])
    .select("id");

  if (chargeError) {
    logError(
      "[onlinePaymentsBackend] Erro ao atualizar charge após pagamento online:",
      chargeError,
    );
    return { payment, chargeId: payment.chargeId, newlyPaid };
  }
  if (!settled || settled.length === 0) {
    const { data: current } = await adminClient.from("charges").select("status").eq("id", payment.chargeId).maybeSingle();
    return { payment, chargeId: payment.chargeId, newlyPaid, conflict: current?.status === "paid" ? "already_paid" : "closed" };
  }

  return { payment, chargeId: payment.chargeId, newlyPaid };
}


export async function expireOnlinePaymentInDb(
  gatewayPaymentId: string,
  provider?: string,
): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  let lookup = adminClient
    .from("online_payments")
    .select("id, organization_id, gateway_provider")
    .eq("gateway_payment_id", gatewayPaymentId)
    .eq("status", "awaiting");
  if (provider) lookup = lookup.eq("gateway_provider", provider);
  const { data: row } = await lookup.maybeSingle();
  if (!row) return true;

  // Venceu no Asaas, mas la ainda e pagavel: exclui, para "Expirado" valer nos dois lados.
  let pending = false;
  if (row.gateway_provider === "asaas") {
    const key = await subaccountKeyOf(String(row.organization_id));
    if (key) {
      const result = await cancelGatewayPayment(gatewayPaymentId, key);
      if (result === "paid") return true; // o webhook de pagamento da a baixa
      pending = result === "failed";
    }
  }
  const { error } = await adminClient
    .from("online_payments")
    .update({ status: "expired", ...(pending ? { gateway_cancel_pending: true } : {}) })
    .eq("id", row.id)
    .eq("status", "awaiting");
  return !error;
}


export async function cancelOnlinePaymentByGatewayIdInDb(
  gatewayPaymentId: string,
  provider?: string,
  reason: string = "Cancelado no gateway",
): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("online_payments")
    .update({ status: "canceled", canceled_reason: reason })
    .eq("gateway_payment_id", gatewayPaymentId)
    .eq("status", "awaiting");

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { error } = await query;
  return !error;
}

