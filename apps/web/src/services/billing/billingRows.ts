import type { Charge } from "@gestarahub/contracts";

/**
 * Cobranca -> linha da tabela `charges`. Fora dos arquivos "use server" de
 * proposito: la so podem ser exportadas funcoes assincronas (server actions).
 */
export function chargeToDbRow(charge: Charge) {
  return {
    id: charge.id,
    organization_id: charge.organizationId,
    unit_id: charge.unitId ?? null,
    student_id: charge.studentId,
    kind: charge.kind,
    plan_id: charge.planId ?? null,
    class_group_id: charge.classGroupId ?? null,
    competence: charge.competence ?? null,
    period_start: charge.periodStart ?? null,
    period_end: charge.periodEnd ?? null,
    session_id: charge.sessionId ?? null,
    due_date: charge.dueDate,
    amount_cents: charge.amountCents,
    status: charge.status,
    paid_at: charge.paidAt ?? null,
    method: charge.method ?? null,
    paid_via: charge.paidVia ?? null,
    attachments: charge.attachments ?? [],
    canceled_by: charge.canceledBy ?? null,
    cancel_reason: charge.cancelReason ?? null,
    refunds: charge.refunds ?? [],
    replaced: charge.replaced ?? false,
    scholarship_percent: charge.scholarshipPercent ?? null,
    list_amount_cents: charge.listAmountCents ?? null,
    description: charge.description ?? null,
    installment_group_id: charge.installmentGroupId ?? null,
    enrollment_id: charge.enrollmentId ?? null,
    student_package_id: charge.studentPackageId ?? null,
    cycle_index: charge.cycleIndex ?? null,
    cycle_total: charge.cycleTotal ?? null,
    is_prorated: charge.isProrated ?? false,
    prorated_days: charge.proratedDays ?? null,
    notes: charge.notes ?? null,
  };
}
