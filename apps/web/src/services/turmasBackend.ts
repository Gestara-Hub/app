"use server";

import type {
  Attendance,
  AttendanceStatus,
  ClassGroup,
  ClassGroupFilter,
  ClassReservation,
  ClassSessionOverride,
  Enrollment,
  Id,
  UpdateClassGroup,
  WaitlistEntry,
  WaitlistStatus,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

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

function mapRowToAttendance(row: Record<string, unknown>): Attendance {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    status: (row.status as AttendanceStatus) || "present",
    markedAt: row.marked_at ? new Date(String(row.marked_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToWaitlist(row: Record<string, unknown>): WaitlistEntry {
  return {
    id: String(row.id),
    classGroupId: String(row.class_group_id),
    studentId: String(row.student_id),
    position: typeof row.position === "number" ? row.position : 1,
    status: (row.status as WaitlistStatus) || "waiting",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToReservation(row: Record<string, unknown>): ClassReservation {
  return {
    id: String(row.id),
    classGroupId: String(row.class_group_id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    kind: (row.kind as ClassReservation["kind"]) || "dropin",
    chargeId: row.charge_id ? String(row.charge_id) : undefined,
    status: (row.status as ClassReservation["status"]) || "reserved",
    reservedAt: row.reserved_at ? new Date(String(row.reserved_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToOverride(row: Record<string, unknown>): ClassSessionOverride {
  return {
    sessionId: String(row.session_id),
    instructorId: row.instructor_id ? String(row.instructor_id) : undefined,
    reason: row.reason ? String(row.reason) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// Class Groups (Turmas)
// =============================================================================

export async function listClassGroupsFromDb(
  organizationId: string,
  filter?: ClassGroupFilter,
): Promise<ClassGroup[]> {
  const client = await getClientForTenant();
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

  const { data, error } = await query;
  if (error) {
    console.error("[turmasBackend] Erro ao listar turmas:", error);
    throw new Error("Erro ao consultar turmas no banco de dados.");
  }

  let result = (data || []).map(mapRowToClassGroup);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((g) => g.name.toLowerCase().includes(term));
  }

  return result;
}

export async function getClassGroupFromDb(
  id: Id,
  organizationId: string,
): Promise<ClassGroup | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_groups")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[turmasBackend] Erro ao buscar turma:", error);
    throw new Error("Erro ao consultar turma no banco de dados.");
  }

  return data ? mapRowToClassGroup(data) : null;
}

export async function createClassGroupInDb(
  group: ClassGroup,
): Promise<ClassGroup> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_groups")
    .insert({
      id: group.id,
      organization_id: group.organizationId,
      unit_id: group.unitId,
      name: group.name.trim(),
      modality_id: group.modalityId ?? null,
      instructor_id: group.instructorId,
      enrollment_type: group.enrollmentType ?? "fixed",
      capacity: group.capacity,
      plan_id: group.planId ?? null,
      allow_dropin: group.allowDropin ?? false,
      session_price_cents: group.sessionPriceCents ?? null,
      meeting_slots: group.meetingSlots ?? [],
      start_date: group.startDate,
      end_date: group.endDate ?? null,
      billing_mode: group.billingMode ?? "membership",
      course_price_cents: group.coursePriceCents ?? null,
      course_max_installments: group.courseMaxInstallments ?? null,
      schedule_history: group.scheduleHistory ?? [],
      status: group.status,
    })
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao criar turma:", error);
    throw new Error("Erro ao salvar turma no banco de dados.");
  }

  return mapRowToClassGroup(data);
}

export async function updateClassGroupInDb(
  id: Id,
  payload: UpdateClassGroup,
  organizationId: string,
  extra?: { scheduleHistory?: ClassGroup["scheduleHistory"] },
): Promise<ClassGroup> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.modalityId !== undefined) updateData.modality_id = payload.modalityId || null;
  if (payload.instructorId !== undefined) updateData.instructor_id = payload.instructorId;
  if (payload.enrollmentType !== undefined) updateData.enrollment_type = payload.enrollmentType;
  if (payload.capacity !== undefined) updateData.capacity = payload.capacity;
  if (payload.planId !== undefined) updateData.plan_id = payload.planId || null;
  if (payload.allowDropin !== undefined) updateData.allow_dropin = payload.allowDropin;
  if (payload.sessionPriceCents !== undefined) updateData.session_price_cents = payload.sessionPriceCents ?? null;
  if (payload.meetingSlots !== undefined) updateData.meeting_slots = payload.meetingSlots;
  if (payload.startDate !== undefined) updateData.start_date = payload.startDate;
  if (payload.endDate !== undefined) updateData.end_date = payload.endDate || null;
  if (payload.billingMode !== undefined) updateData.billing_mode = payload.billingMode;
  if (payload.coursePriceCents !== undefined) updateData.course_price_cents = payload.coursePriceCents ?? null;
  if (payload.courseMaxInstallments !== undefined) updateData.course_max_installments = payload.courseMaxInstallments ?? null;
  if (extra?.scheduleHistory !== undefined) updateData.schedule_history = extra.scheduleHistory;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data, error } = await client
    .from("class_groups")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao atualizar turma:", error);
    throw new Error("Erro ao atualizar turma no banco de dados.");
  }

  return mapRowToClassGroup(data);
}

export async function setClassGroupStatusInDb(
  id: Id,
  status: "active" | "inactive",
  organizationId: string,
): Promise<ClassGroup> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_groups")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao alterar status da turma:", error);
    throw new Error("Erro ao atualizar status da turma no banco de dados.");
  }

  return mapRowToClassGroup(data);
}

// =============================================================================
// Enrollments (Matrículas)
// =============================================================================

export async function listEnrollmentsFromDb(
  organizationId: string,
  classGroupId?: Id,
): Promise<Enrollment[]> {
  const client = await getClientForTenant();
  let query = client
    .from("enrollments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("enrolled_at", { ascending: true });

  if (classGroupId) {
    query = query.eq("class_group_id", classGroupId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[turmasBackend] Erro ao listar matrículas:", error);
    throw new Error("Erro ao consultar matrículas no banco de dados.");
  }

  return (data || []).map(mapRowToEnrollment);
}

export async function createEnrollmentInDb(
  enrollment: Enrollment,
  organizationId: string,
): Promise<Enrollment> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("enrollments")
    .insert({
      id: enrollment.id,
      organization_id: organizationId,
      class_group_id: enrollment.classGroupId,
      student_id: enrollment.studentId,
      status: enrollment.status,
      enrolled_at: enrollment.enrolledAt,
      canceled_at: enrollment.canceledAt ?? null,
      cancellation_reason: enrollment.cancellationReason ?? null,
      course: enrollment.course ?? null,
      pays_with_package: enrollment.paysWithPackage ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao criar matrícula:", error);
    throw new Error("Erro ao salvar matrícula no banco de dados.");
  }

  return mapRowToEnrollment(data);
}

export async function updateEnrollmentInDb(
  id: Id,
  payload: Partial<Enrollment>,
  organizationId: string,
): Promise<Enrollment> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.canceledAt !== undefined) updateData.canceled_at = payload.canceledAt;
  if (payload.cancellationReason !== undefined) updateData.cancellation_reason = payload.cancellationReason;
  if (payload.course !== undefined) updateData.course = payload.course;
  if (payload.paysWithPackage !== undefined) updateData.pays_with_package = payload.paysWithPackage;

  const { data, error } = await client
    .from("enrollments")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao atualizar matrícula:", error);
    throw new Error("Erro ao atualizar matrícula no banco de dados.");
  }

  return mapRowToEnrollment(data);
}

export async function cancelEnrollmentInDb(
  id: Id,
  reason: string | undefined,
  canceledAt: string,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("enrollments")
    .update({
      status: "canceled",
      canceled_at: canceledAt,
      cancellation_reason: reason ?? null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[turmasBackend] Erro ao cancelar matrícula:", error);
    throw new Error("Erro ao cancelar matrícula no banco de dados.");
  }
}

// =============================================================================
// Attendances (Chamadas / Presenças)
// =============================================================================

export async function listAttendancesFromDb(
  organizationId: string,
  sessionId?: Id,
): Promise<Attendance[]> {
  const client = await getClientForTenant();
  let query = client
    .from("attendances")
    .select("*")
    .eq("organization_id", organizationId);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[turmasBackend] Erro ao listar presenças:", error);
    throw new Error("Erro ao consultar chamadas no banco de dados.");
  }

  return (data || []).map(mapRowToAttendance);
}

export async function upsertAttendanceInDb(
  attendance: Attendance,
  organizationId: string,
): Promise<Attendance> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("attendances")
    .upsert(
      {
        id: attendance.id,
        organization_id: organizationId,
        session_id: attendance.sessionId,
        student_id: attendance.studentId,
        status: attendance.status,
        marked_at: attendance.markedAt,
      },
      { onConflict: "organization_id,session_id,student_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao registrar presença:", error);
    throw new Error("Erro ao salvar chamada no banco de dados.");
  }

  return mapRowToAttendance(data);
}

export async function deleteAttendanceInDb(
  sessionId: Id,
  studentId: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("attendances")
    .delete()
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[turmasBackend] Erro ao remover presença:", error);
    throw new Error("Erro ao desfazer chamada no banco de dados.");
  }
}

// =============================================================================
// Waitlist (Lista de Espera)
// =============================================================================

export async function listWaitlistFromDb(
  organizationId: string,
  classGroupId?: Id,
): Promise<WaitlistEntry[]> {
  const client = await getClientForTenant();
  let query = client
    .from("waitlist")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (classGroupId) {
    query = query.eq("class_group_id", classGroupId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[turmasBackend] Erro ao listar lista de espera:", error);
    throw new Error("Erro ao consultar lista de espera no banco de dados.");
  }

  return (data || []).map(mapRowToWaitlist);
}

export async function addToWaitlistInDb(
  entry: WaitlistEntry,
  organizationId: string,
): Promise<WaitlistEntry> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("waitlist")
    .insert({
      id: entry.id,
      organization_id: organizationId,
      class_group_id: entry.classGroupId,
      student_id: entry.studentId,
      position: entry.position,
      status: entry.status,
      created_at: entry.createdAt,
    })
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao adicionar à lista de espera:", error);
    throw new Error("Erro ao salvar entrada na lista de espera.");
  }

  return mapRowToWaitlist(data);
}

export async function updateWaitlistStatusInDb(
  id: Id,
  status: WaitlistStatus,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("waitlist")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[turmasBackend] Erro ao atualizar status na lista de espera:", error);
    throw new Error("Erro ao atualizar status na lista de espera.");
  }
}

export async function reorderWaitlistInDb(
  classGroupId: Id,
  orderedIds: Id[],
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await client
      .from("waitlist")
      .update({ position: i + 1 })
      .eq("id", orderedIds[i])
      .eq("organization_id", organizationId)
      .eq("class_group_id", classGroupId);

    if (error) {
      console.error("[turmasBackend] Erro ao reordenar lista de espera:", error);
    }
  }
}

// =============================================================================
// Class Reservations (Drop-in / Trial / Pacote)
// =============================================================================

export async function listReservationsFromDb(
  organizationId: string,
  sessionId?: Id,
): Promise<ClassReservation[]> {
  const client = await getClientForTenant();
  let query = client
    .from("class_reservations")
    .select("*")
    .eq("organization_id", organizationId);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[turmasBackend] Erro ao listar reservas:", error);
    throw new Error("Erro ao consultar reservas no banco de dados.");
  }

  return (data || []).map(mapRowToReservation);
}

export async function createReservationInDb(
  reservation: ClassReservation,
  organizationId: string,
): Promise<ClassReservation> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_reservations")
    .insert({
      id: reservation.id,
      organization_id: organizationId,
      class_group_id: reservation.classGroupId,
      session_id: reservation.sessionId,
      student_id: reservation.studentId,
      kind: reservation.kind ?? "dropin",
      charge_id: reservation.chargeId ?? null,
      status: reservation.status,
      reserved_at: reservation.reservedAt,
    })
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao criar reserva:", error);
    throw new Error("Erro ao salvar reserva no banco de dados.");
  }

  return mapRowToReservation(data);
}

export async function cancelReservationBySessionStudentInDb(
  sessionId: Id,
  studentId: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("class_reservations")
    .update({ status: "canceled" })
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[turmasBackend] Erro ao cancelar reserva:", error);
    throw new Error("Erro ao cancelar reserva no banco de dados.");
  }
}

// =============================================================================
// Class Session Overrides (Substituições de Professor)
// =============================================================================

export async function listSessionOverridesFromDb(
  organizationId: string,
): Promise<ClassSessionOverride[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_session_overrides")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[turmasBackend] Erro ao listar substituições:", error);
    throw new Error("Erro ao consultar substituições no banco de dados.");
  }

  return (data || []).map(mapRowToOverride);
}

export async function upsertSessionOverrideInDb(
  override: ClassSessionOverride,
  organizationId: string,
): Promise<ClassSessionOverride> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("class_session_overrides")
    .upsert(
      {
        organization_id: organizationId,
        session_id: override.sessionId,
        instructor_id: override.instructorId ?? null,
        reason: override.reason ?? null,
      },
      { onConflict: "organization_id,session_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[turmasBackend] Erro ao salvar substituição:", error);
    throw new Error("Erro ao salvar substituição no banco de dados.");
  }

  return mapRowToOverride(data);
}

export async function deleteSessionOverrideInDb(
  sessionId: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("class_session_overrides")
    .delete()
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[turmasBackend] Erro ao excluir substituição:", error);
    throw new Error("Erro ao restaurar instrutor titular no banco de dados.");
  }
}
