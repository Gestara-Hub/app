import type { OnlinePayment } from "@gestarahub/contracts";

/** Linha de `online_payments` no contrato (modulo comum: o arquivo "use server" so exporta actions). */
export function mapRowToOnlinePayment(row: Record<string, unknown>): OnlinePayment {
  const expiresAt = row.expires_at
    ? new Date(String(row.expires_at)).toISOString()
    : new Date().toISOString();
  let status = (row.status as OnlinePayment["status"]) || "awaiting";
  if (status === "awaiting" && expiresAt <= new Date().toISOString()) {
    status = "expired";
  }

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    chargeId: String(row.charge_id),
    method: (row.method as OnlinePayment["method"]) || "pix",
    status,
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : 0,
    splitAmountCents:
      typeof row.split_amount_cents === "number" ? row.split_amount_cents : 0,
    gatewayFeeCents:
      typeof row.gateway_fee_cents === "number" ? row.gateway_fee_cents : 0,
    paidMethod: (row.paid_method as OnlinePayment["paidMethod"]) ?? undefined,
    netAmountCents:
      typeof row.net_amount_cents === "number" ? row.net_amount_cents : 0,
    gatewayProvider: row.gateway_provider
      ? String(row.gateway_provider)
      : undefined,
    gatewayPaymentId: row.gateway_payment_id
      ? String(row.gateway_payment_id)
      : undefined,
    pixCopyPaste: row.pix_copy_paste ? String(row.pix_copy_paste) : undefined,
    pixQrCodeBase64: row.pix_qr_code_base64
      ? String(row.pix_qr_code_base64)
      : undefined,
    linkUrl: row.link_url ? String(row.link_url) : undefined,
    feePassedToCustomer: Boolean(row.fee_passed_to_customer),
    canceledReason: row.canceled_reason ? String(row.canceled_reason) : undefined,
    expiresAt,
    paidAt: row.paid_at
      ? new Date(String(row.paid_at)).toISOString()
      : undefined,
    createdAt: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

/** Forma gravada na cobranca do aluno quando o pagamento online e confirmado. */
export function chargeMethodOf(payment: OnlinePayment): "pix" | "card" | "other" {
  const used = payment.paidMethod;
  if (used === "pix") return "pix";
  if (used === "creditCard" || used === "debitCard") return "card";
  if (used === "boleto") return "other";
  return payment.method === "pix" ? "pix" : payment.method === "link" ? "card" : "other";
}
