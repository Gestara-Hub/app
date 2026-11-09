// Modulo so do servidor, usado pelo cron diario (app/api/cron/daily) com o
// cliente administrativo. Sem "use server" de proposito: nao e action, entao o
// navegador nao chama com um organizationId qualquer (doc 15, fatia 2).

import { selectAllRows } from "@/lib/supabase/select-all";
import type {
  Client,
  ClientFilter,
} from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";


function mapRowToClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    birthDate: row.birth_date ? String(row.birth_date) : undefined,
    cpf: row.cpf ? String(row.cpf) : undefined,
    guardians: (row.guardians as Client["guardians"]) || undefined,
    notes: row.notes ? String(row.notes) : undefined,
    address: (row.address as Client["address"]) || undefined,
    planId: row.plan_id ? String(row.plan_id) : undefined,
    planStartDate: row.plan_start_date ? String(row.plan_start_date) : undefined,
    chargesFrom: row.charges_from ? String(row.charges_from) : undefined,
    billingStrategy: (row.billing_strategy as Client["billingStrategy"]) || undefined,
    cyclePaymentTiming: (row.cycle_payment_timing as Client["cyclePaymentTiming"]) || undefined,
    dueDay: typeof row.due_day === "number" ? row.due_day : 10,
    discount: (row.discount as Client["discount"]) || undefined,
    membershipStatus: (row.membership_status as Client["membershipStatus"]) || "active",
    progressions: (row.progressions as Client["progressions"]) || {},
    minorConsentStatus: (row.minor_consent_status as Client["minorConsentStatus"]) || "not_applicable",
    minorConsentAt: row.minor_consent_at ? new Date(String(row.minor_consent_at)).toISOString() : undefined,
    minorConsentBy: row.minor_consent_by ? String(row.minor_consent_by) : undefined,
    minorConsentEvidence: (row.minor_consent_evidence as Record<string, unknown>) || undefined,
    status: (row.status as Client["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

export async function listClientsFromDb(
  organizationId: string,
  filter?: ClientFilter,
): Promise<Client[]> {
  const client = createSupabaseAdminClient();
  // Todas as paginas: a consulta para em 1.000 linhas (doc 19, fase 0).
  const build = () => {
    let query = client
      .from("clients")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.planId) {
      query = query.eq("plan_id", filter.planId);
    }
    if (filter?.membershipStatus) {
      query = query.eq("membership_status", filter.membershipStatus);
    }
    if (filter?.search?.trim()) {
      const term = filter.search.trim();
      const digits = term.replace(/\D/g, "");
      if (digits.length >= 3) {
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${digits}%`);
      } else {
        query = query.ilike("name", `%${term}%`);
      }
    }
    return query;
  };

  const { data, error } = await selectAllRows(build);
  if (error) {
    logError("[clientsBackend] Erro ao listar clients:", error);
    throw new Error("Erro ao consultar alunos no banco de dados.");
  }

  return (data ?? []).map((row) => mapRowToClient(row as Record<string, unknown>));
}

