"use server";

import type {
  Charge,
  ChargeFilter,
  FileAttachment,
  Id,
  Plan,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

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
  const client = await getClientForTenant();
  let query = client
    .from("plans")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (filter?.period) query = query.eq("period", filter.period);
  if (filter?.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) {
    console.error("[billingBackend] Erro ao listar planos:", error);
    throw new Error("Erro ao consultar planos no banco de dados.");
  }

  let result = (data || []).map(mapRowToPlan);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((p) => p.name.toLowerCase().includes(term));
  }
  return result;
}

export async function getPlanFromDb(
  id: Id,
  organizationId: string,
): Promise<Plan | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("plans")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[billingBackend] Erro ao obter plano:", error);
    throw new Error("Erro ao consultar plano no banco de dados.");
  }

  return data ? mapRowToPlan(data) : null;
}

export async function createPlanInDb(plan: Plan): Promise<Plan> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("plans")
    .insert({
      id: plan.id,
      organization_id: plan.organizationId,
      name: plan.name.trim(),
      price_cents: plan.priceCents,
      period: plan.period,
      status: plan.status,
    })
    .select()
    .single();

  if (error) {
    console.error("[billingBackend] Erro ao criar plano:", error);
    throw new Error("Erro ao salvar plano no banco de dados.");
  }

  return mapRowToPlan(data);
}

export async function updatePlanInDb(
  id: Id,
  payload: UpdatePlan,
  organizationId: string,
): Promise<Plan> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.priceCents !== undefined) updateData.price_cents = payload.priceCents;
  if (payload.period !== undefined) updateData.period = payload.period;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data, error } = await client
    .from("plans")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[billingBackend] Erro ao atualizar plano:", error);
    throw new Error("Erro ao atualizar plano no banco de dados.");
  }

  return mapRowToPlan(data);
}

// =============================================================================
// Charge Backend Operations
// =============================================================================

export async function listChargesFromDb(
  organizationId: string,
  filter?: ChargeFilter,
): Promise<Charge[]> {
  const client = await getClientForTenant();
  let query = client
    .from("charges")
    .select("*")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true });

  if (filter?.competence) query = query.eq("competence", filter.competence);
  if (filter?.kind) query = query.eq("kind", filter.kind);
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.studentId) query = query.eq("student_id", filter.studentId);

  const { data, error } = await query;
  if (error) {
    console.error("[billingBackend] Erro ao listar cobranças:", error);
    throw new Error("Erro ao consultar cobranças no banco de dados.");
  }

  return (data || []).map(mapRowToCharge);
}

export async function getChargeFromDb(
  id: Id,
  organizationId: string,
): Promise<Charge | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("charges")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[billingBackend] Erro ao obter cobrança:", error);
    throw new Error("Erro ao consultar cobrança no banco de dados.");
  }

  return data ? mapRowToCharge(data) : null;
}

function chargeToDbRow(charge: Charge) {
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

export async function insertChargesInDb(charges: Charge[]): Promise<Charge[]> {
  if (charges.length === 0) return [];
  const client = await getClientForTenant();
  const rows = charges.map(chargeToDbRow);

  const { data, error } = await client
    .from("charges")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    console.error("[billingBackend] Erro ao inserir cobranças:", error);
    throw new Error("Erro ao salvar cobranças no banco de dados.");
  }

  return (data || []).map(mapRowToCharge);
}

export async function updateChargeInDb(
  id: Id,
  updates: Partial<Charge>,
  organizationId: string,
): Promise<Charge> {
  const client = await getClientForTenant();
  const dbUpdates: Record<string, unknown> = {};

  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.paidAt !== undefined) dbUpdates.paid_at = updates.paidAt;
  if (updates.method !== undefined) dbUpdates.method = updates.method;
  if (updates.paidVia !== undefined) dbUpdates.paid_via = updates.paidVia;
  if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;
  if (updates.canceledBy !== undefined) dbUpdates.canceled_by = updates.canceledBy;
  if (updates.cancelReason !== undefined) dbUpdates.cancel_reason = updates.cancelReason;
  if (updates.replaced !== undefined) dbUpdates.replaced = updates.replaced;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.amountCents !== undefined) dbUpdates.amount_cents = updates.amountCents;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;

  const { data, error } = await client
    .from("charges")
    .update(dbUpdates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[billingBackend] Erro ao atualizar cobrança:", error);
    throw new Error("Erro ao atualizar cobrança no banco de dados.");
  }

  return mapRowToCharge(data);
}

export async function deleteChargesByIdsInDb(
  ids: Id[],
  organizationId: string,
): Promise<void> {
  if (ids.length === 0) return;
  const client = await getClientForTenant();
  const { error } = await client
    .from("charges")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (error) {
    console.error("[billingBackend] Erro ao remover cobranças:", error);
    throw new Error("Erro ao remover cobranças no banco de dados.");
  }
}
