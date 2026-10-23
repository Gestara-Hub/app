// Modulo so do servidor, usado pelo cron diario (app/api/cron/daily) com o
// cliente administrativo. Sem "use server" de proposito: nao e action, entao o
// navegador nao chama com um organizationId qualquer (doc 15, fatia 2).

import { selectAllRows } from "@/lib/supabase/select-all";
import type {
  ClassGroup,
  ClassGroupFilter,
  Enrollment,
  Id,
} from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToClassGroup(row: Record<string, unknown>): ClassGroup {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: String(row.unit_id),
    name: String(row.name),
    modalityId: row.modality_id ? String(row.modality_id) : undefined,
    instructorId: String(row.instructor_id),
    enrollmentType: (row.enrollment_type as ClassGroup["enrollmentType"]) || "fixed",
    capacity: typeof row.capacity === "number" ? row.capacity : 20,
    planId: row.plan_id ? String(row.plan_id) : undefined,
    allowDropin: Boolean(row.allow_dropin),
    sessionPriceCents: typeof row.session_price_cents === "number" ? row.session_price_cents : undefined,
    meetingSlots: (row.meeting_slots as ClassGroup["meetingSlots"]) || [],
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : undefined,
    billingMode: (row.billing_mode as ClassGroup["billingMode"]) || "membership",
    coursePriceCents: typeof row.course_price_cents === "number" ? row.course_price_cents : undefined,
    courseMaxInstallments: typeof row.course_max_installments === "number" ? row.course_max_installments : undefined,
    scheduleHistory: (row.schedule_history as ClassGroup["scheduleHistory"]) || [],
    status: (row.status as ClassGroup["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToEnrollment(row: Record<string, unknown>): Enrollment {
  return {
    id: String(row.id),
    classGroupId: String(row.class_group_id),
    studentId: String(row.student_id),
    status: (row.status as Enrollment["status"]) || "active",
    enrolledAt: row.enrolled_at ? new Date(String(row.enrolled_at)).toISOString() : new Date().toISOString(),
    canceledAt: row.canceled_at ? new Date(String(row.canceled_at)).toISOString() : undefined,
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : undefined,
    course: (row.course as Enrollment["course"]) || undefined,
    paysWithPackage: Boolean(row.pays_with_package),
  };
}

// =============================================================================
// Class Groups (Turmas)
// =============================================================================

export async function listClassGroupsFromDb(
  organizationId: string,
  filter?: ClassGroupFilter,
): Promise<ClassGroup[]> {
  const client = createSupabaseAdminClient();
  // Todas as paginas: a consulta para em 1.000 linhas (doc 19, fase 0).
  const build = () => {
    let query = client
      .from("class_groups")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.modalityId) {
      query = query.eq("modality_id", filter.modalityId);
    }
    if (filter?.instructorId) {
      query = query.eq("instructor_id", filter.instructorId);
    }
    return query;
  };

  const { data, error } = await selectAllRows(build);
  if (error) {
    logError("[turmasBackend] Erro ao listar turmas:", error);
    throw new Error("Erro ao consultar turmas no banco de dados.");
  }

  let result = (data || []).map(mapRowToClassGroup);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((g) => g.name.toLowerCase().includes(term));
  }

  return result;
}

// =============================================================================
// Enrollments (Matrículas)
// =============================================================================

export async function listEnrollmentsFromDb(
  organizationId: string,
  classGroupId?: Id,
): Promise<Enrollment[]> {
  const client = createSupabaseAdminClient();
  // Todas as paginas: a consulta para em 1.000 linhas (doc 19, fase 0).
  const build = () => {
    let query = client
      .from("enrollments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("enrolled_at", { ascending: true });

    if (classGroupId) {
      query = query.eq("class_group_id", classGroupId);
    }
    return query;
  };

  const { data, error } = await selectAllRows(build);
  if (error) {
    logError("[turmasBackend] Erro ao listar matrículas:", error);
    throw new Error("Erro ao consultar matrículas no banco de dados.");
  }

  return (data || []).map(mapRowToEnrollment);
}

