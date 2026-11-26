"use server";

import { getSubaccountBalance, refundPayment } from "@/lib/asaas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn, withErrorScope } from "@/lib/log";
import { requireTenant } from "../server/tenant";
import { realSubaccountKey } from "./gatewaySetup";
import { refundDescription } from "./refundDescription";

/**
 * Estorno do pagamento online de uma cobranca (26/11/2026, doc product/15
 * "Estorno de pagamento"): primeiro passo da devolucao. Confere o saldo
 * disponivel (o Asaas exige o valor cheio), pede o estorno do total (cobranca
 * com split nao aceita parcial) e marca o pagamento como estornado. O segundo
 * passo, na tela, e `billingService.refundCharge` (reabrir ou encerrar).
 *
 * Como action, o navegador chama direto: so vale o que o servidor confere
 * (permissao, cobranca do proprio espaco, paga online, chave da subconta lida aqui).
 */
export type RefundOnlinePaymentResult =
  | {
      ok: true;
      /** Ja estava estornado (painel do Asaas): so falta decidir a cobranca. */
      alreadyRefunded?: boolean;
      /** O Asaas espera o codigo (evento critico) para devolver. */
      needsConfirmation?: boolean;
    }
  | {
      ok: false;
      error: string;
      reason?: "insufficient_balance";
      availableCents?: number;
      neededCents?: number;
    };

export async function refundOnlinePaymentAction(chargeId: string, reason?: string): Promise<RefundOnlinePaymentResult> {
  return withErrorScope(async () => {
    const ctx = await requireTenant();
    ctx.require("billing:manage");
    const admin = createSupabaseAdminClient();

    const { data: charge } = await admin
      .from("charges")
      .select("organization_id, status, paid_via")
      .eq("id", chargeId)
      .maybeSingle();
    if (!charge || charge.organization_id !== ctx.organizationId) return { ok: false, error: "Cobrança não encontrada." };
    if (charge.status !== "paid") return { ok: false, error: "Só dá para estornar uma cobrança paga." };
    if (charge.paid_via !== "online" && charge.paid_via !== "recurring") {
      return { ok: false, error: "Esta cobrança foi paga fora do app: registre o estorno." };
    }

    const { data: payments } = await admin
      .from("online_payments")
      .select("id, amount_cents, gateway_provider, gateway_payment_id, dispute_status, refund_handled_at")
      .eq("charge_id", chargeId)
      .eq("organization_id", ctx.organizationId)
      .eq("status", "paid")
      .is("refund_handled_at", null)
      .order("paid_at", { ascending: false });
    const payment = payments?.[0];
    if (!payment) return { ok: false, error: "Não achamos o pagamento online desta cobrança." };
    if (payment.dispute_status === "refunded" || payment.dispute_status === "refund_in_progress") {
      return { ok: true, alreadyRefunded: true };
    }

    const markRefund = async (status: "refunded" | "refund_in_progress") => {
      const { error } = await admin
        .from("online_payments")
        .update({ dispute_status: status, disputed_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (error) logError("[refundOnlinePaymentAction] Estorno pedido, mas não gravado no pagamento:", error);
    };

    // Demonstracao (sem parceiro de verdade): marca estornado direto.
    if (payment.gateway_provider !== "asaas" || !payment.gateway_payment_id) {
      await markRefund("refunded");
      return { ok: true };
    }

    const { data: org } = await admin
      .from("organizations")
      .select("gateway_api_key")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    const apiKey = realSubaccountKey(org?.gateway_api_key);
    if (!apiKey) return { ok: false, error: "A conta de recebimento não está ativa." };

    const neededCents = Number(payment.amount_cents) || 0;
    try {
      const balance = await getSubaccountBalance(apiKey);
      const availableCents = Math.round((balance.balance || 0) * 100);
      if (availableCents < neededCents) {
        return {
          ok: false,
          reason: "insufficient_balance",
          availableCents,
          neededCents,
          error: "Saldo disponível insuficiente para estornar.",
        };
      }
    } catch (err) {
      // Sem a leitura do saldo, o proprio Asaas recusa se faltar; segue.
      logWarn("[refundOnlinePaymentAction] Saldo não lido antes do estorno:", err);
    }

    try {
      const res = await refundPayment(String(payment.gateway_payment_id), apiKey, refundDescription(reason));
      const needsConfirmation = (res.refunds ?? []).some((r) => r.status === "AWAITING_CRITICAL_ACTION_AUTHORIZATION");
      await markRefund(res.status === "REFUNDED" ? "refunded" : "refund_in_progress");
      return { ok: true, needsConfirmation };
    } catch (err) {
      logError("[refundOnlinePaymentAction] Asaas recusou o estorno:", err);
      const message = err instanceof Error && err.message ? err.message : "O parceiro recusou o estorno.";
      return { ok: false, error: message };
    }
  });
}
