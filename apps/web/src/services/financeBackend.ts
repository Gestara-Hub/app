"use server";

import type {
  FileAttachment,
  FinancialCategory,
  FinancialCategoryFilter,
  FinancialEntry,
  FinancialEntryFilter,
  FinancialRecurrence,
  Id,
  UpdateFinancialCategory,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToCategory(row: Record<string, unknown>): FinancialCategory {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    type: row.type as FinancialCategory["type"],
    name: String(row.name),
    system: Boolean(row.system),
    systemKey: row.system_key ? (row.system_key as FinancialCategory["systemKey"]) : undefined,
    status: row.status as FinancialCategory["status"],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToRecurrence(row: Record<string, unknown>): FinancialRecurrence {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    type: row.type as FinancialRecurrence["type"],
    categoryId: String(row.category_id),
    description: String(row.description),
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents),
    dayOfMonth: typeof row.day_of_month === "number" ? row.day_of_month : Number(row.day_of_month),
    startCompetence: String(row.start_competence),
    endCompetence: row.end_competence ? String(row.end_competence) : undefined,
    status: row.status as FinancialRecurrence["status"],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToEntry(row: Record<string, unknown>): FinancialEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: row.unit_id ? String(row.unit_id) : undefined,
    type: row.type as FinancialEntry["type"],
    categoryId: String(row.category_id),
    description: String(row.description),
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents),
    dueDate: String(row.due_date).slice(0, 10),
    status: row.status as FinancialEntry["status"],
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : undefined,
    method: row.method ? (row.method as FinancialEntry["method"]) : undefined,
    recurrenceId: row.recurrence_id ? String(row.recurrence_id) : undefined,
    recurrenceCompetence: row.recurrence_competence ? String(row.recurrence_competence) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    attachments: (row.attachments as FileAttachment[]) || [],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// Categories Backend Operations
// =============================================================================

export async function listFinancialCategoriesFromDb(
  organizationId: string,
  filter?: FinancialCategoryFilter,
): Promise<FinancialCategory[]> {
  const client = await getClientForTenant();
  let query = client
    .from("financial_categories")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (filter?.type) {
    query = query.eq("type", filter.type);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.includeSystem === false) {
    query = query.eq("system", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[financeBackend] Erro ao listar categorias:", error);
    throw new Error("Erro ao consultar categorias financeiras no banco de dados.");
  }

  return (data || []).map(mapRowToCategory);
}

export async function getFinancialCategoryFromDb(
  id: Id,
  organizationId: string,
): Promise<FinancialCategory | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_categories")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[financeBackend] Erro ao buscar categoria:", error);
    throw new Error("Erro ao consultar categoria financeira no banco de dados.");
  }

  return data ? mapRowToCategory(data) : null;
}

export async function createFinancialCategoryInDb(
  category: FinancialCategory,
): Promise<FinancialCategory> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_categories")
    .insert({
      id: category.id,
      organization_id: category.organizationId,
      type: category.type,
      name: category.name.trim(),
      system: category.system ?? false,
      system_key: category.systemKey ?? null,
      status: category.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao criar categoria:", error);
    throw new Error("Erro ao salvar categoria financeira no banco de dados.");
  }

  return mapRowToCategory(data);
}

export async function updateFinancialCategoryInDb(
  id: Id,
  payload: UpdateFinancialCategory,
  organizationId: string,
): Promise<FinancialCategory> {
  const client = await getClientForTenant();
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await client
    .from("financial_categories")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao atualizar categoria:", error);
    throw new Error("Erro ao atualizar categoria financeira no banco de dados.");
  }

  return mapRowToCategory(data);
}

// =============================================================================
// Recurrences Backend Operations
// =============================================================================

export async function listFinancialRecurrencesFromDb(
  organizationId: string,
): Promise<FinancialRecurrence[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_recurrences")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[financeBackend] Erro ao listar recorrências:", error);
    throw new Error("Erro ao consultar recorrências financeiras no banco de dados.");
  }

  return (data || []).map(mapRowToRecurrence);
}

export async function createFinancialRecurrenceInDb(
  recurrence: FinancialRecurrence,
): Promise<FinancialRecurrence> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_recurrences")
    .insert({
      id: recurrence.id,
      organization_id: recurrence.organizationId,
      type: recurrence.type,
      category_id: recurrence.categoryId,
      description: recurrence.description.trim(),
      amount_cents: recurrence.amountCents,
      day_of_month: recurrence.dayOfMonth,
      start_competence: recurrence.startCompetence,
      end_competence: recurrence.endCompetence ?? null,
      status: recurrence.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao criar recorrência:", error);
    throw new Error("Erro ao salvar recorrência financeira no banco de dados.");
  }

  return mapRowToRecurrence(data);
}

export async function updateFinancialRecurrenceInDb(
  id: Id,
  payload: Partial<Pick<FinancialRecurrence, "categoryId" | "description" | "amountCents" | "dayOfMonth" | "endCompetence" | "status">>,
  organizationId: string,
): Promise<FinancialRecurrence> {
  const client = await getClientForTenant();
  const updates: Record<string, unknown> = {};
  if (payload.categoryId !== undefined) updates.category_id = payload.categoryId;
  if (payload.description !== undefined) updates.description = payload.description.trim();
  if (payload.amountCents !== undefined) updates.amount_cents = payload.amountCents;
  if (payload.dayOfMonth !== undefined) updates.day_of_month = payload.dayOfMonth;
  if (payload.endCompetence !== undefined) updates.end_competence = payload.endCompetence;
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await client
    .from("financial_recurrences")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao atualizar recorrência:", error);
    throw new Error("Erro ao atualizar recorrência financeira no banco de dados.");
  }

  return mapRowToRecurrence(data);
}

// =============================================================================
// Entries Backend Operations
// =============================================================================

export async function listFinancialEntriesFromDb(
  organizationId: string,
  filter?: FinancialEntryFilter,
): Promise<FinancialEntry[]> {
  const client = await getClientForTenant();
  let query = client
    .from("financial_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: false });

  if (filter?.type) {
    query = query.eq("type", filter.type);
  }
  if (filter?.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }
  if (filter?.competence) {
    const start = `${filter.competence}-01`;
    const [y, m] = filter.competence.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${filter.competence}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("due_date", start).lte("due_date", end);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[financeBackend] Erro ao listar lançamentos:", error);
    throw new Error("Erro ao consultar lançamentos financeiros no banco de dados.");
  }

  return (data || []).map(mapRowToEntry);
}

export async function getFinancialEntryFromDb(
  id: Id,
  organizationId: string,
): Promise<FinancialEntry | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_entries")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[financeBackend] Erro ao obter lançamento:", error);
    throw new Error("Erro ao consultar lançamento no banco de dados.");
  }

  return data ? mapRowToEntry(data) : null;
}

export async function createFinancialEntryInDb(
  entry: FinancialEntry,
): Promise<FinancialEntry> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("financial_entries")
    .insert({
      id: entry.id,
      organization_id: entry.organizationId,
      unit_id: entry.unitId ?? null,
      type: entry.type,
      category_id: entry.categoryId,
      description: entry.description.trim(),
      amount_cents: entry.amountCents,
      due_date: entry.dueDate,
      status: entry.status,
      paid_at: entry.paidAt ?? null,
      method: entry.method ?? null,
      recurrence_id: entry.recurrenceId ?? null,
      recurrence_competence: entry.recurrenceCompetence ?? null,
      notes: entry.notes ?? null,
      attachments: entry.attachments ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao criar lançamento:", error);
    throw new Error("Erro ao salvar lançamento no banco de dados.");
  }

  return mapRowToEntry(data);
}

export async function insertFinancialEntriesBatchInDb(
  entries: FinancialEntry[],
): Promise<FinancialEntry[]> {
  if (entries.length === 0) return [];
  const client = await getClientForTenant();
  const rows = entries.map((entry) => ({
    id: entry.id,
    organization_id: entry.organizationId,
    unit_id: entry.unitId ?? null,
    type: entry.type,
    category_id: entry.categoryId,
    description: entry.description.trim(),
    amount_cents: entry.amountCents,
    due_date: entry.dueDate,
    status: entry.status,
    paid_at: entry.paidAt ?? null,
    method: entry.method ?? null,
    recurrence_id: entry.recurrenceId ?? null,
    recurrence_competence: entry.recurrenceCompetence ?? null,
    notes: entry.notes ?? null,
    attachments: entry.attachments ?? [],
  }));

  const { data, error } = await client
    .from("financial_entries")
    .insert(rows)
    .select();

  if (error) {
    console.error("[financeBackend] Erro ao inserir lote de lançamentos:", error);
    throw new Error("Erro ao materializar recorrências financeiras no banco de dados.");
  }

  return (data || []).map(mapRowToEntry);
}

export async function updateFinancialEntryInDb(
  id: Id,
  payload: Partial<FinancialEntry>,
  organizationId: string,
): Promise<FinancialEntry> {
  const client = await getClientForTenant();
  const updates: Record<string, unknown> = {};

  if (payload.categoryId !== undefined) updates.category_id = payload.categoryId;
  if (payload.description !== undefined) updates.description = payload.description.trim();
  if (payload.amountCents !== undefined) updates.amount_cents = payload.amountCents;
  if (payload.dueDate !== undefined) updates.due_date = payload.dueDate;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.paidAt !== undefined) updates.paid_at = payload.paidAt;
  if (payload.method !== undefined) updates.method = payload.method;
  if (payload.notes !== undefined) updates.notes = payload.notes;
  if (payload.attachments !== undefined) updates.attachments = payload.attachments;

  const { data, error } = await client
    .from("financial_entries")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[financeBackend] Erro ao atualizar lançamento:", error);
    throw new Error("Erro ao atualizar lançamento no banco de dados.");
  }

  return mapRowToEntry(data);
}

export async function deleteFinancialEntryInDb(
  id: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("financial_entries")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[financeBackend] Erro ao excluir lançamento:", error);
    throw new Error("Erro ao excluir lançamento no banco de dados.");
  }
}

export async function deleteFinancialEntriesByRecurrenceInDb(
  recurrenceId: Id,
  organizationId: string,
  afterDueDate?: string,
): Promise<number> {
  const client = await getClientForTenant();
  let query = client
    .from("financial_entries")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("recurrence_id", recurrenceId)
    .eq("status", "pending");

  if (afterDueDate) {
    query = query.gte("due_date", afterDueDate);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[financeBackend] Erro ao cancelar lançamentos futuros de recorrência:", error);
    throw new Error("Erro ao cancelar lançamentos futuros da série no banco de dados.");
  }

  return count || 0;
}
