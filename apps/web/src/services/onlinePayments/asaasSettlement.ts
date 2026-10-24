import { linkMethodFromAsaasBillingType } from "@gestarahub/core/payment-fees";
import { asaasToday } from "@/lib/asaas/dates";
import type { AsaasPaymentResponse } from "@/lib/asaas/types";
import { markOnlinePaymentPaidInDb } from "./onlinePaymentsWebhook";

/**
 * Baixa de um pagamento a partir do que o Asaas informa (webhook ou consulta
 * da rotina de hora em hora). Modulo so do servidor, sem "use server".
 */

/**
 * O Asaas manda a data do pagamento sem hora ("2026-10-21"). Guardada como esta,
 * vira meia-noite UTC e aparece como 21h do dia anterior no Brasil. Hoje: a hora
 * em que o aviso chegou. Outro dia: meio-dia no horario de Brasilia.
 */
export function paidAtFromAsaas(value: string | undefined | null): string {
  const now = new Date();
  if (!value) return now.toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value).toISOString();
  return value === asaasToday() ? now.toISOString() : new Date(`${value}T12:00:00-03:00`).toISOString();
}

/**
 * Marca como pago com os dados do Asaas. `released`: RECEIVED (disponivel) ou
 * CONFIRMED (pago, saldo ainda nao liberado; cartao ~32 dias).
 */
export function settleAsaasPayment(payment: AsaasPaymentResponse, released: boolean) {
  const paidAt = paidAtFromAsaas(payment.clientPaymentDate || payment.paymentDate);
  // netValue ja vem sem a tarifa do Asaas; billingType diz se foi credito ou debito.
  const netValue = Number(payment.netValue);
  const todayInBrazil = asaasToday();
  const creditDate = released
    ? (payment.creditDate ?? payment.estimatedCreditDate ?? todayInBrazil)
    : (payment.estimatedCreditDate ?? payment.creditDate ?? undefined);
  return markOnlinePaymentPaidInDb(payment.id, paidAt, "asaas", {
    netValueCents: Number.isFinite(netValue) ? Math.round(netValue * 100) : undefined,
    paidMethod: linkMethodFromAsaasBillingType(payment.billingType),
    release: { released, creditDate: creditDate?.slice(0, 10) },
    receiptUrl: payment.transactionReceiptUrl ?? undefined,
  });
}
