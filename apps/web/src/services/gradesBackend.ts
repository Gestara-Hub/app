"use server";

import type {
  Assessment,
  AssessmentGrade,
  Id,
  UpdateAssessment,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToAssessment(row: Record<string, unknown>): Assessment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    classGroupId: String(row.class_group_id),
    modalityId: String(row.modality_id),
    name: String(row.name),
    date: String(row.date).slice(0, 10),
    weight: typeof row.weight === "number" ? row.weight : Number(row.weight) || 1,
    levelId: row.level_id ? String(row.level_id) : undefined,
    grades: (row.grades as AssessmentGrade[]) || [],
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

// =============================================================================
// Assessment Backend Operations
// =============================================================================

export async function listAssessmentsFromDb(
  organizationId: string,
): Promise<Assessment[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("assessments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("date", { ascending: false });

  if (error) {
    console.error("[gradesBackend] Erro ao listar avaliações:", error);
    throw new Error("Erro ao consultar avaliações no banco de dados.");
  }

  return (data || []).map(mapRowToAssessment);
}

export async function listAssessmentsByClassFromDb(
  organizationId: string,
  classGroupId: string,
): Promise<Assessment[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("assessments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("class_group_id", classGroupId)
    .order("date", { ascending: false });

  if (error) {
    console.error("[gradesBackend] Erro ao listar avaliações da turma:", error);
    throw new Error("Erro ao consultar avaliações da turma no banco de dados.");
  }

  return (data || []).map(mapRowToAssessment);
}

export async function getAssessmentFromDb(
  id: Id,
  organizationId: string,
): Promise<Assessment | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("assessments")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[gradesBackend] Erro ao obter avaliação:", error);
    throw new Error("Erro ao consultar avaliação no banco de dados.");
  }

  return data ? mapRowToAssessment(data) : null;
}

export async function createAssessmentInDb(
  assessment: Assessment,
): Promise<Assessment> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("assessments")
    .insert({
      id: assessment.id,
      organization_id: assessment.organizationId,
      class_group_id: assessment.classGroupId,
      modality_id: assessment.modalityId,
      name: assessment.name.trim(),
      date: assessment.date,
      weight: assessment.weight,
      level_id: assessment.levelId ?? null,
      grades: assessment.grades ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[gradesBackend] Erro ao criar avaliação:", error);
    throw new Error("Erro ao salvar avaliação no banco de dados.");
  }

  return mapRowToAssessment(data);
}

export async function updateAssessmentInDb(
  id: Id,
  payload: UpdateAssessment,
  organizationId: string,
): Promise<Assessment> {
  const client = await getClientForTenant();
  const dbUpdates: Record<string, unknown> = {};

  if (payload.name !== undefined) dbUpdates.name = payload.name.trim();
  if (payload.date !== undefined) dbUpdates.date = payload.date;
  if (payload.weight !== undefined) dbUpdates.weight = payload.weight;
  if (payload.levelId !== undefined) dbUpdates.level_id = payload.levelId;

  const { data, error } = await client
    .from("assessments")
    .update(dbUpdates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[gradesBackend] Erro ao atualizar avaliação:", error);
    throw new Error("Erro ao atualizar avaliação no banco de dados.");
  }

  return mapRowToAssessment(data);
}

export async function deleteAssessmentInDb(
  id: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("assessments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[gradesBackend] Erro ao excluir avaliação:", error);
    throw new Error("Erro ao excluir avaliação no banco de dados.");
  }
}

export async function setGradesInDb(
  id: Id,
  grades: AssessmentGrade[],
  organizationId: string,
): Promise<Assessment> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("assessments")
    .update({ grades })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[gradesBackend] Erro ao gravar notas:", error);
    throw new Error("Erro ao salvar notas no banco de dados.");
  }

  return mapRowToAssessment(data);
}
