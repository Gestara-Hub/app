"use server";

import type {
  Attendance,
  CarriedLessons,
  Id,
  LessonPackage,
  LessonPackageFilter,
  PackageUsage,
  StudentPackage,
  StudentPackageFilter,
  UpdateLessonPackage,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToLessonPackage(row: Record<string, unknown>): LessonPackage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    lessons: typeof row.lessons === "number" ? row.lessons : 1,
    priceCents: typeof row.price_cents === "number" ? row.price_cents : 0,
    validityDays: typeof row.validity_days === "number" ? row.validity_days : undefined,
    classGroupIds: (row.class_group_ids as string[]) || [],
    modalityIds: (row.modality_ids as string[]) || [],
    absenceConsumes: Boolean(row.absence_consumes),
    status: (row.status as LessonPackage["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToStudentPackage(row: Record<string, unknown>): StudentPackage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: row.unit_id ? String(row.unit_id) : undefined,
    studentId: String(row.student_id),
    packageId: String(row.package_id),
    name: String(row.name),
    lessonsTotal: typeof row.lessons_total === "number" ? row.lessons_total : 0,
    lessonsUsed: typeof row.lessons_used === "number" ? row.lessons_used : 0,
    purchasedAt: String(row.purchased_at).slice(0, 10),
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : undefined,
    classGroupIds: Array.isArray(row.class_group_ids) ? (row.class_group_ids as string[]) : undefined,
    modalityIds: (row.modality_ids as string[]) || [],
    absenceConsumes: Boolean(row.absence_consumes),
    status: (row.status as StudentPackage["status"]) || "active",
    carriedOverLessons: typeof row.carried_over_lessons === "number" ? row.carried_over_lessons : undefined,
    carriedFrom: (row.carried_from as CarriedLessons[]) || [],
    renewedFromId: row.renewed_from_id ? String(row.renewed_from_id) : undefined,
    renewedIntoId: row.renewed_into_id ? String(row.renewed_into_id) : undefined,
    chargeIds: (row.charge_ids as string[]) || [],
    usages: (row.usages as PackageUsage[]) || [],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// LessonPackage (Catálogo) Backend Operations
// =============================================================================

export async function listLessonPackagesFromDb(
  organizationId: string,
  filter?: LessonPackageFilter,
): Promise<LessonPackage[]> {
  const client = await getClientForTenant();
  let query = client
    .from("lesson_packages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (filter?.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) {
    console.error("[packagesBackend] Erro ao listar pacotes do catálogo:", error);
    throw new Error("Erro ao consultar pacotes no banco de dados.");
  }

  let result = (data || []).map(mapRowToLessonPackage);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((p) => p.name.toLowerCase().includes(term));
  }
  return result;
}

export async function getLessonPackageFromDb(
  id: Id,
  organizationId: string,
): Promise<LessonPackage | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("lesson_packages")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[packagesBackend] Erro ao obter pacote:", error);
    throw new Error("Erro ao consultar pacote no banco de dados.");
  }

  return data ? mapRowToLessonPackage(data) : null;
}

export async function createLessonPackageInDb(pkg: LessonPackage): Promise<LessonPackage> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("lesson_packages")
    .insert({
      id: pkg.id,
      organization_id: pkg.organizationId,
      name: pkg.name.trim(),
      lessons: pkg.lessons,
      price_cents: pkg.priceCents,
      validity_days: pkg.validityDays ?? null,
      class_group_ids: pkg.classGroupIds ?? [],
      modality_ids: pkg.modalityIds ?? [],
      absence_consumes: pkg.absenceConsumes ?? true,
      status: pkg.status,
    })
    .select()
    .single();

  if (error) {
    console.error("[packagesBackend] Erro ao criar pacote:", error);
    throw new Error("Erro ao salvar pacote no banco de dados.");
  }

  return mapRowToLessonPackage(data);
}

export async function updateLessonPackageInDb(
  id: Id,
  payload: UpdateLessonPackage,
  organizationId: string,
): Promise<LessonPackage> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.lessons !== undefined) updateData.lessons = payload.lessons;
  if (payload.priceCents !== undefined) updateData.price_cents = payload.priceCents;
  if (payload.validityDays !== undefined) updateData.validity_days = payload.validityDays ?? null;
  if (payload.classGroupIds !== undefined) updateData.class_group_ids = payload.classGroupIds;
  if (payload.modalityIds !== undefined) updateData.modality_ids = payload.modalityIds;
  if (payload.absenceConsumes !== undefined) updateData.absence_consumes = payload.absenceConsumes;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data, error } = await client
    .from("lesson_packages")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[packagesBackend] Erro ao atualizar pacote:", error);
    throw new Error("Erro ao atualizar pacote no banco de dados.");
  }

  return mapRowToLessonPackage(data);
}

// =============================================================================
// StudentPackage (Pacotes dos Alunos) Backend Operations
// =============================================================================

export async function listStudentPackagesFromDb(
  organizationId: string,
  filter?: StudentPackageFilter,
): Promise<StudentPackage[]> {
  const client = await getClientForTenant();
  let query = client
    .from("student_packages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("purchased_at", { ascending: false });

  if (filter?.studentId) query = query.eq("student_id", filter.studentId);
  if (filter?.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) {
    console.error("[packagesBackend] Erro ao listar pacotes dos alunos:", error);
    throw new Error("Erro ao consultar pacotes dos alunos no banco de dados.");
  }

  return (data || []).map(mapRowToStudentPackage);
}

export async function getStudentPackageFromDb(
  id: Id,
  organizationId: string,
): Promise<StudentPackage | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("student_packages")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[packagesBackend] Erro ao obter pacote do aluno:", error);
    throw new Error("Erro ao consultar pacote do aluno no banco de dados.");
  }

  return data ? mapRowToStudentPackage(data) : null;
}

function studentPackageToDbRow(pkg: StudentPackage) {
  return {
    id: pkg.id,
    organization_id: pkg.organizationId,
    unit_id: pkg.unitId ?? null,
    student_id: pkg.studentId,
    package_id: pkg.packageId,
    name: pkg.name,
    lessons_total: pkg.lessonsTotal,
    lessons_used: pkg.lessonsUsed,
    purchased_at: pkg.purchasedAt,
    expires_at: pkg.expiresAt ?? null,
    class_group_ids: pkg.classGroupIds ?? null,
    modality_ids: pkg.modalityIds ?? [],
    absence_consumes: pkg.absenceConsumes ?? true,
    status: pkg.status,
    carried_over_lessons: pkg.carriedOverLessons ?? null,
    carried_from: pkg.carriedFrom ?? [],
    renewed_from_id: pkg.renewedFromId ?? null,
    renewed_into_id: pkg.renewedIntoId ?? null,
    charge_ids: pkg.chargeIds ?? [],
    usages: pkg.usages ?? [],
  };
}

export async function createStudentPackageInDb(
  pkg: StudentPackage,
): Promise<StudentPackage> {
  const client = await getClientForTenant();
  const row = studentPackageToDbRow(pkg);

  const { data, error } = await client
    .from("student_packages")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[packagesBackend] Erro ao registrar pacote do aluno:", error);
    throw new Error("Erro ao salvar pacote do aluno no banco de dados.");
  }

  return mapRowToStudentPackage(data);
}

export async function updateStudentPackageInDb(
  id: Id,
  updates: Partial<StudentPackage>,
  organizationId: string,
): Promise<StudentPackage> {
  const client = await getClientForTenant();
  const dbUpdates: Record<string, unknown> = {};

  if (updates.lessonsTotal !== undefined) dbUpdates.lessons_total = updates.lessonsTotal;
  if (updates.lessonsUsed !== undefined) dbUpdates.lessons_used = updates.lessonsUsed;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.carriedOverLessons !== undefined) dbUpdates.carried_over_lessons = updates.carriedOverLessons;
  if (updates.carriedFrom !== undefined) dbUpdates.carried_from = updates.carriedFrom;
  if (updates.renewedFromId !== undefined) dbUpdates.renewed_from_id = updates.renewedFromId ?? null;
  if (updates.renewedIntoId !== undefined) dbUpdates.renewed_into_id = updates.renewedIntoId ?? null;
  if (updates.usages !== undefined) dbUpdates.usages = updates.usages;
  if (updates.chargeIds !== undefined) dbUpdates.charge_ids = updates.chargeIds;

  const { data, error } = await client
    .from("student_packages")
    .update(dbUpdates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[packagesBackend] Erro ao atualizar pacote do aluno:", error);
    throw new Error("Erro ao atualizar pacote do aluno no banco de dados.");
  }

  return mapRowToStudentPackage(data);
}

/**
 * Chamada e gasto do pacote na mesma transacao (funcao SQL
 * `apply_attendance_with_packages`). `attendance` nulo desmarca a presenca.
 * Os pacotes chegam ja recalculados pelo service (saldo e usos).
 */
export async function applyAttendanceWithPackagesInDb(input: {
  organizationId: Id;
  sessionId: Id;
  studentId: Id;
  attendance: Attendance | null;
  packages: StudentPackage[];
}): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client.rpc("apply_attendance_with_packages", {
    p_organization_id: input.organizationId,
    p_session_id: input.sessionId,
    p_student_id: input.studentId,
    p_attendance: input.attendance
      ? {
          id: input.attendance.id,
          status: input.attendance.status,
          marked_at: input.attendance.markedAt,
        }
      : null,
    p_packages: input.packages.map(studentPackageToDbRow),
  });

  if (error) {
    console.error("[packagesBackend] Erro ao gravar chamada com pacote:", error);
    throw new Error("Erro ao salvar a chamada no banco de dados.");
  }
}

export async function upsertMultipleStudentPackagesInDb(
  packages: StudentPackage[],
): Promise<StudentPackage[]> {
  if (packages.length === 0) return [];
  const client = await getClientForTenant();
  const rows = packages.map(studentPackageToDbRow);

  const { data, error } = await client
    .from("student_packages")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    console.error("[packagesBackend] Erro ao atualizar múltiplos pacotes:", error);
    throw new Error("Erro ao atualizar pacotes dos alunos no banco de dados.");
  }

  return (data || []).map(mapRowToStudentPackage);
}
