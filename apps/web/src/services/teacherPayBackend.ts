"use server";

import type {
  FileAttachment,
  Id,
  TeacherPayComponent,
  TeacherPayout,
  TeacherPayoutLine,
  TeacherPayRule,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToRule(row: Record<string, unknown>): TeacherPayRule {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    professionalId: String(row.professional_id),
    components: (row.components as TeacherPayComponent[]) || [],
    paymentDay: typeof row.payment_day === "number" ? row.payment_day : 5,
    startCompetence: String(row.start_competence),
    status: row.status as TeacherPayRule["status"],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToPayout(row: Record<string, unknown>): TeacherPayout {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    professionalId: String(row.professional_id),
    competence: String(row.competence),
    lines: (row.lines as TeacherPayoutLine[]) || [],
    totalCents: typeof row.total_cents === "number" ? row.total_cents : Number(row.total_cents),
    dueDate: String(row.due_date).slice(0, 10),
    status: row.status as TeacherPayout["status"],
    closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : undefined,
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : undefined,
    method: row.method ? (row.method as TeacherPayout["method"]) : undefined,
    attachments: (row.attachments as FileAttachment[]) || [],
    countedChargeIds: (row.counted_charge_ids as Id[]) || [],
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// Teacher Pay Rules Operations
// =============================================================================

export async function listTeacherPayRulesFromDb(
  organizationId: string,
): Promise<TeacherPayRule[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_pay_rules")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[teacherPayBackend] Erro ao listar regras de remuneração:", error);
    throw new Error("Erro ao consultar regras de remuneração no banco de dados.");
  }

  return (data || []).map(mapRowToRule);
}

export async function getTeacherPayRuleByProfessionalFromDb(
  professionalId: Id,
  organizationId: string,
): Promise<TeacherPayRule | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_pay_rules")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[teacherPayBackend] Erro ao buscar regra de remuneração:", error);
    throw new Error("Erro ao consultar regra de remuneração no banco de dados.");
  }

  return data ? mapRowToRule(data) : null;
}

export async function saveTeacherPayRuleInDb(
  rule: TeacherPayRule,
): Promise<TeacherPayRule> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_pay_rules")
    .upsert(
      {
        id: rule.id,
        organization_id: rule.organizationId,
        professional_id: rule.professionalId,
        components: rule.components,
        payment_day: rule.paymentDay ?? 5,
        start_competence: rule.startCompetence,
        status: rule.status,
      },
      { onConflict: "organization_id,professional_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[teacherPayBackend] Erro ao salvar regra de remuneração:", error);
    throw new Error("Erro ao salvar regra de remuneração no banco de dados.");
  }

  return mapRowToRule(data);
}

// =============================================================================
// Teacher Payouts Operations
// =============================================================================

export async function listTeacherPayoutsFromDb(
  organizationId: string,
  competence?: string,
): Promise<TeacherPayout[]> {
  const client = await getClientForTenant();
  let query = client
    .from("teacher_payouts")
    .select("*")
    .eq("organization_id", organizationId);

  if (competence) {
    query = query.eq("competence", competence);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[teacherPayBackend] Erro ao listar pagamentos de professores:", error);
    throw new Error("Erro ao consultar pagamentos de professores no banco de dados.");
  }

  return (data || []).map(mapRowToPayout);
}

export async function getTeacherPayoutFromDb(
  id: Id,
  organizationId: string,
): Promise<TeacherPayout | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_payouts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[teacherPayBackend] Erro ao obter fechamento de professor:", error);
    throw new Error("Erro ao consultar fechamento de professor no banco de dados.");
  }

  return data ? mapRowToPayout(data) : null;
}

export async function getPayoutByProfessionalAndCompetenceFromDb(
  professionalId: Id,
  competence: string,
  organizationId: string,
): Promise<TeacherPayout | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_payouts")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("competence", competence)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[teacherPayBackend] Erro ao obter fechamento por competência:", error);
    throw new Error("Erro ao consultar fechamento de professor no banco de dados.");
  }

  return data ? mapRowToPayout(data) : null;
}

export async function saveTeacherPayoutInDb(
  payout: TeacherPayout,
): Promise<TeacherPayout> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("teacher_payouts")
    .upsert(
      {
        id: payout.id,
        organization_id: payout.organizationId,
        professional_id: payout.professionalId,
        competence: payout.competence,
        lines: payout.lines,
        total_cents: payout.totalCents,
        due_date: payout.dueDate,
        status: payout.status,
        closed_at: payout.closedAt ?? null,
        paid_at: payout.paidAt ?? null,
        method: payout.method ?? null,
        attachments: payout.attachments ?? [],
        counted_charge_ids: payout.countedChargeIds ?? [],
        notes: payout.notes ?? null,
      },
      { onConflict: "organization_id,professional_id,competence" },
    )
    .select()
    .single();

  if (error) {
    console.error("[teacherPayBackend] Erro ao salvar fechamento de professor:", error);
    throw new Error("Erro ao salvar fechamento de professor no banco de dados.");
  }

  return mapRowToPayout(data);
}

export async function deleteTeacherPayoutInDb(
  id: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("teacher_payouts")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[teacherPayBackend] Erro ao excluir fechamento de professor:", error);
    throw new Error("Erro ao excluir fechamento de professor no banco de dados.");
  }
}
