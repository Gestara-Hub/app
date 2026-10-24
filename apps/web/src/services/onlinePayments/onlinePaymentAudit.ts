import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChargeKind, OnlinePayment } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { chargeLabelOf, competenceLabelOf, PAID_METHOD_LABEL } from "../server/paymentPage";
import { recordSystemAudit } from "../server/systemAudit";

/**
 * Pagamento online de aluno confirmado pelo parceiro (webhook) na Auditoria
 * (doc technical/23): "Parceiro de pagamentos confirmou o Pix de Ana Souza
 * (R$ 150,00, mensalidade de nov)". Uma vez por pagamento. Modulo so do servidor.
 */
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
