"use server";

import type {
  Category,
  CategoryFilter,
  Id,
  UpdateCategory,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

function mapRowToCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    position: typeof row.position === "number" ? row.position : 0,
    progressionTrack: (row.progression_track as Category["progressionTrack"]) || undefined,
    assessments: (row.assessments as Category["assessments"]) || undefined,
    status: (row.status as Category["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

export async function listCategoriesFromDb(
  organizationId: string,
  filter?: CategoryFilter,
): Promise<Category[]> {
  const client = await getClientForTenant();
  let query = client
    .from("categories")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[categoriesBackend] Erro ao listar categorias:", error);
    throw new Error("Erro ao consultar modalidades no banco de dados.");
  }

  let result = (data || []).map(mapRowToCategory);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter((c) => c.name.toLowerCase().includes(term));
  }

  return result;
}

export async function getCategoryFromDb(
  id: Id,
  organizationId: string,
): Promise<Category | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[categoriesBackend] Erro ao buscar categoria:", error);
    throw new Error("Erro ao consultar modalidade no banco de dados.");
  }

  return data ? mapRowToCategory(data) : null;
}

export async function createCategoryInDb(
  category: Category,
): Promise<Category> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("categories")
    .insert({
      id: category.id,
      organization_id: category.organizationId,
      name: category.name.trim(),
      position: category.position,
      progression_track: category.progressionTrack ?? null,
      assessments: category.assessments ?? null,
      status: category.status,
    })
    .select()
    .single();

  if (error) {
    console.error("[categoriesBackend] Erro ao criar categoria:", error);
    throw new Error("Erro ao salvar modalidade no banco de dados.");
  }

  return mapRowToCategory(data);
}

export async function updateCategoryInDb(
  id: Id,
  payload: UpdateCategory,
  organizationId: string,
): Promise<Category> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.position !== undefined) updateData.position = payload.position;
  if (payload.progressionTrack !== undefined) updateData.progression_track = payload.progressionTrack ?? null;
  if (payload.assessments !== undefined) updateData.assessments = payload.assessments ?? null;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data, error } = await client
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[categoriesBackend] Erro ao atualizar categoria:", error);
    throw new Error("Erro ao atualizar modalidade no banco de dados.");
  }

  return mapRowToCategory(data);
}

export async function inactivateCategoryInDb(
  id: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("categories")
    .update({ status: "inactive" })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[categoriesBackend] Erro ao inativar categoria:", error);
    throw new Error("Erro ao inativar modalidade no banco de dados.");
  }
}
