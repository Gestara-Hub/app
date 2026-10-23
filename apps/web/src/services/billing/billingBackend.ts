// Modulo so do servidor, usado pelo cron diario (app/api/cron/daily) com o
// cliente administrativo. Sem "use server" de proposito: nao e action, entao o
// navegador nao chama com um organizationId qualquer (doc 15, fatia 2).

import { selectAllRows } from "@/lib/supabase/select-all";
import type {
  Charge,
  ChargeFilter,
  FileAttachment,
  Plan,
  PlanFilter,
} from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToPlan(row: Record<string, unknown>): Plan {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    priceCents: typeof row.price_cents === "number" ? row.price_cents : 0,
    period: (row.period as Plan["period"]) || "monthly",
    status: (row.status as Plan["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToCharge(row: Record<string, unknown>): Charge {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: row.unit_id ? String(row.unit_id) : undefined,
    studentId: String(row.student_id),
    kind: (row.kind as Charge["kind"]) || "membership",
    planId: row.plan_id ? String(row.plan_id) : undefined,
    classGroupId: row.class_group_id ? String(row.class_group_id) : undefined,
    competence: row.competence ? String(row.competence) : undefined,
    periodStart: row.period_start ? String(row.period_start).slice(0, 10) : undefined,
    periodEnd: row.period_end ? String(row.period_end).slice(0, 10) : undefined,
    sessionId: row.session_id ? String(row.session_id) : undefined,
    dueDate: String(row.due_date).slice(0, 10),
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : 0,
    status: (row.status as Charge["status"]) || "pending",
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : undefined,
    method: (row.method as Charge["method"]) || undefined,
    paidVia: (row.paid_via as Charge["paidVia"]) || undefined,
    attachments: (row.attachments as FileAttachment[]) || [],
    canceledBy: (row.canceled_by as Charge["canceledBy"]) || undefined,
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : undefined,
    replaced: Boolean(row.replaced),
    scholarshipPercent: typeof row.scholarship_percent === "number" ? row.scholarship_percent : undefined,
    listAmountCents: typeof row.list_amount_cents === "number" ? row.list_amount_cents : undefined,
    description: row.description ? String(row.description) : undefined,
    installmentGroupId: row.installment_group_id ? String(row.installment_group_id) : undefined,
    enrollmentId: row.enrollment_id ? String(row.enrollment_id) : undefined,
    studentPackageId: row.student_package_id ? String(row.student_package_id) : undefined,
    cycleIndex: typeof row.cycle_index === "number" ? row.cycle_index : undefined,
    cycleTotal: typeof row.cycle_total === "number" ? row.cycle_total : undefined,
    isProrated: Boolean(row.is_prorated),
    proratedDays: typeof row.prorated_days === "number" ? row.prorated_days : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// Plan Backend Operations
// =============================================================================

export async function listPlansFromDb(
  organizationId: string,
  filter?: PlanFilter,
): Promise<Plan[]> {
  const client = createSupabaseAdminClient();
  // Todas as paginas: a consulta para em 1.000 linhas (doc 19, fase 0).
  const build = () => {
    let query = client
      .from("plans")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (filter?.period) query = query.eq("period", filter.period);
    if (filter?.status) query = query.eq("status", filter.status);
    return query;
  };

  const { data, error } = await selectAllRows(build);
  if (error) {
    logError("[billingBackend] Erro ao listar planos:", error);
    throw new Error("Erro ao consultar planos no banco de dados.");
  }

  let result = (data || []).map(mapRowToPlan);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((p) => p.name.toLowerCase().includes(term));
  }
  return result;
}

// =============================================================================
// Charge Backend Operations
// =============================================================================

export async function listChargesFromDb(
  organizationId: string,
  filter?: ChargeFilter,
): Promise<Charge[]> {
  const client = createSupabaseAdminClient();
  // Todas as paginas: a consulta para em 1.000 linhas (doc 19, fase 0).
  const build = () => {
    let query = client
      .from("charges")
      .select("*")
      .eq("organization_id", organizationId)
      .order("due_date", { ascending: true });

    if (filter?.competence) query = query.eq("competence", filter.competence);
    if (filter?.kind) query = query.eq("kind", filter.kind);
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.studentId) query = query.eq("student_id", filter.studentId);
    return query;
  };

  const { data, error } = await selectAllRows(build);
  if (error) {
    logError("[billingBackend] Erro ao listar cobranças:", error);
    throw new Error("Erro ao consultar cobranças no banco de dados.");
  }

  return (data || []).map(mapRowToCharge);
}

