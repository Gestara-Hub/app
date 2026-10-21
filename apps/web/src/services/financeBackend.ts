// Modulo so do servidor, usado pelo cron diario (app/api/cron/daily) com o
// cliente administrativo. Sem "use server" de proposito: nao e action, entao o
// navegador nao chama com um organizationId qualquer (doc 15, fatia 2).

import type {
  FileAttachment,
  FinancialEntry,
  FinancialEntryFilter,
  FinancialRecurrence,
} from "@gestarahub/contracts";
import { randomUUID } from "node:crypto";
import { addCompetence, materializeRecurrence, recurrenceDueDate } from "@gestarahub/core/finance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export async function listFinancialRecurrencesFromDb(
  organizationId: string,
): Promise<FinancialRecurrence[]> {
  const client = createSupabaseAdminClient();
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

export async function listFinancialEntriesFromDb(
  organizationId: string,
  filter?: FinancialEntryFilter,
): Promise<FinancialEntry[]> {
  const client = createSupabaseAdminClient();
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

/**
 * Lancamentos das recorrencias no servidor (doc 15, fatia 1): mesma regra pura
 * (`materializeRecurrence`, ate o mes seguinte) sobre o banco, gravando por
 * `insert_recurrence_entries`, que ignora o que ja existe (indice unico da
 * migracao 27). Idempotente e segura com dois aparelhos. Devolve quantos criou.
 */
export async function materializeRecurrencesAction(organizationId: string): Promise<number> {
  const client = createSupabaseAdminClient();
  const [recurrences, entries, { data: unit }] = await Promise.all([
    listFinancialRecurrencesFromDb(organizationId),
    listFinancialEntriesFromDb(organizationId),
    client.from("units").select("id").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);
  // Mes atual no horario do espaco (Brasilia), nao no do servidor.
  const current = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const upTo = addCompetence(current, 1);

  const rows: Record<string, unknown>[] = [];
  for (const r of recurrences) {
    const existing = entries
      .filter((e) => e.recurrenceId === r.id && e.recurrenceCompetence)
      .map((e) => e.recurrenceCompetence!);
    for (const competence of materializeRecurrence(r, existing, upTo)) {
      rows.push({
        id: randomUUID(),
        unit_id: unit?.id ?? null,
        type: r.type,
        category_id: r.categoryId,
        description: r.description,
        amount_cents: r.amountCents,
        due_date: recurrenceDueDate(r, competence),
        recurrence_id: r.id,
        recurrence_competence: competence,
      });
    }
  }
  if (rows.length === 0) return 0;

  const { data: created, error } = await client.rpc("insert_recurrence_entries", {
    p_organization_id: organizationId,
    p_rows: rows,
  });
  if (error) {
    console.error("[materializeRecurrencesAction] Erro ao gravar lançamentos repetidos:", error);
    throw new Error("Não foi possível gerar os lançamentos repetidos.");
  }
  return Number(created) || 0;
}
