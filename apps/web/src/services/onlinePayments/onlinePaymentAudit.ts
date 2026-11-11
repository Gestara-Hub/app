import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChargeKind, OnlinePayment, OnlinePaymentDisputeStatus } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { chargeLabelOf, competenceLabelOf, PAID_METHOD_LABEL } from "../server/paymentPage";
import { recordSystemAudit } from "../server/systemAudit";

/**
 * Pagamento online de aluno confirmado pelo parceiro (webhook) na Auditoria
 * (doc technical/23): "Parceiro de pagamentos confirmou o Pix de Ana Souza
 * (R$ 150,00, mensalidade de nov)". Uma vez por pagamento. Modulo so do servidor.
 */
/**
 * Pagamento online de uma cobranca que nao estava mais em aberto (paga por outro
 * meio, cancelada ou isenta): a cobranca fica como estava e o valor recebido vira
 * aviso na Auditoria do espaco, para o dono devolver ou combinar o uso.
 */
export async function auditOnlinePaymentConflict(
  admin: SupabaseClient,
  payment: OnlinePayment,
  conflict: "already_paid" | "closed",
): Promise<void> {
  if (!payment.organizationId) return;
  const { data: charge } = await admin
    .from("charges")
    .select("kind, description, competence, student_id, status")
    .eq("id", payment.chargeId)
    .maybeSingle();
  const { data: student } = charge?.student_id
    ? await admin.from("clients").select("name").eq("id", charge.student_id).maybeSingle()
    : { data: null };
  const name = String(student?.name ?? "aluno");
  const what = charge ? chargeLabelOf(charge.kind as ChargeKind, (charge.description as string | null) ?? null) : "Cobrança";
  const state = conflict === "already_paid" ? "já estava paga" : charge?.status === "waived" ? "estava isenta" : "estava cancelada";
  await recordSystemAudit(admin, "webhook.asaas", {
    organizationId: payment.organizationId,
    action: "updated",
    target: { type: "charge", id: payment.chargeId, label: `${what} de ${name}` },
    predicate: `recebeu ${formatCents(payment.amountCents)} online de ${name}, mas a cobrança ${state}: devolva ao aluno ou combine o uso do valor`,
  });
}

export const DISPUTE_LABEL: Record<OnlinePaymentDisputeStatus, string> = {
  refund_in_progress: "estorno em andamento",
  refunded: "estorno",
  chargeback_requested: "contestação pedida",
  chargeback_dispute: "contestação em disputa",
  chargeback_reversal_pending: "reversão da contestação pendente",
};

/**
 * Estorno ou contestacao avisados pelo parceiro: na Auditoria uma vez por aviso.
 * A cobranca fica paga; o dono decide (doc product/25, urgencia).
 */
export async function auditOnlinePaymentDispute(admin: SupabaseClient, payment: OnlinePayment): Promise<void> {
  if (!payment.organizationId || !payment.disputeStatus) return;
  const { data: charge } = await admin
    .from("charges")
    .select("kind, description, student_id")
    .eq("id", payment.chargeId)
    .maybeSingle();
  const { data: student } = charge?.student_id
    ? await admin.from("clients").select("name").eq("id", charge.student_id).maybeSingle()
    : { data: null };
  const name = String(student?.name ?? "aluno");
  const what = charge ? chargeLabelOf(charge.kind as ChargeKind, (charge.description as string | null) ?? null) : "Cobrança";
  await recordSystemAudit(admin, "webhook.asaas", {
    organizationId: payment.organizationId,
    action: "updated",
    target: { type: "charge", id: payment.chargeId, label: `${what} de ${name}` },
    predicate: `avisou ${DISPUTE_LABEL[payment.disputeStatus]} no pagamento online de ${name} (${formatCents(payment.amountCents)}); a cobrança continua paga até você decidir`,
    security: true,
  });
}

export async function auditOnlinePaymentPaid(admin: SupabaseClient, payment: OnlinePayment): Promise<void> {
  if (!payment.organizationId) return;
  const { data: charge } = await admin
    .from("charges")
    .select("kind, description, competence, student_id")
    .eq("id", payment.chargeId)
    .maybeSingle();
  const { data: student } = charge?.student_id
    ? await admin.from("clients").select("name").eq("id", charge.student_id).maybeSingle()
    : { data: null };
  const name = String(student?.name ?? "aluno");
  const what = charge ? chargeLabelOf(charge.kind as ChargeKind, (charge.description as string | null) ?? null) : "Cobrança";
  const competence = charge?.kind === "membership" ? competenceLabelOf(charge.competence as string | null) : undefined;
  const method = PAID_METHOD_LABEL[String(payment.paidMethod ?? "")] ?? (payment.method === "pix" ? "Pix" : "pagamento online");
  const detail = [formatCents(payment.amountCents), `${what.toLowerCase()}${competence ? ` de ${competence}` : ""}`].join(", ");
  await recordSystemAudit(admin, "webhook.asaas", {
    organizationId: payment.organizationId,
    action: "updated",
    target: { type: "charge", id: payment.chargeId, label: `${what} de ${name}` },
    predicate: `confirmou o pagamento online de ${name} por ${method} (${detail})`,
    changes: [{ field: "status", label: "Situação", before: "Em aberto", after: "Paga online" }],
  });
}
