"use server";

import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Category, CategoryFilter, Client, CreateCategory, Id, UpdateCategory } from "@gestarahub/contracts";
import { notFoundError } from "@gestarahub/core/api-error";
import { textIncludes } from "@/lib/text";
import { runAction, type ActionResult } from "../server/action";
import { decodeArgs } from "../world/transport";
import { loadOrganization, todayInSpace, UNIQUE_VIOLATION } from "../server/organization";
import { requireTenant, type TenantContext } from "../server/tenant";
import { categoryFromRow } from "./catalogRows";
import {
  categoryNounFor,
  defaultAssessmentsForNewModality,
  duplicateCategoryNameError,
  normalizedAssessments,
  normalizedMeasurements,
  resetMissingLevels,
  sortCategories,
  validateCategoryPayload,
  assertGradingKept,
} from "./categoryRules";

/**
 * Modalidades da conta real (doc 15, fatia 2.1): leitura e gravacao no banco,
 * com o espaco da sessao. Mesmas regras da demonstracao (`categoryRules`).
 */

// Gravacao pelo servidor (chave de servico) depois de conferir a permissao e com
// o espaco da sessao: o banco nao aceita escrita direta do usuario (migracao 78).
const MANAGE = ["classes:manage", "services:manage"] as const;
const NOT_FOUND = "Categoria não encontrada.";

export interface CategoryUpdateResult {
  category: Category;
  /** Alunos que voltaram ao primeiro nivel da trilha nova. */
  reset: number;
}

async function fetchCategory(ctx: TenantContext, id: Id): Promise<Category> {
  const { data, error } = await ctx.client
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFoundError(NOT_FOUND);
  return categoryFromRow(data);
}

export async function listCategoriesAction(filter?: CategoryFilter): Promise<ActionResult<Category[]>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    let query = ctx.client.from("categories").select("*").eq("organization_id", ctx.organizationId);
    if (filter?.status) query = query.eq("status", filter.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    let result = (data ?? []).map(categoryFromRow);
    if (filter?.search) {
      const term = filter.search;
      result = result.filter((c) => textIncludes(c.name, term));
    }
    return sortCategories(result);
  });
}

export async function getCategoryAction(id: Id): Promise<ActionResult<Category>> {
  return runAction(async () => fetchCategory(await requireTenant(), id));
}

export async function createCategoryAction(payload: CreateCategory): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const org = await loadOrganization(ctx);
    const noun = categoryNounFor(org);
    validateCategoryPayload(payload, { partial: false, noun });

    let position = payload.position;
    if (position === undefined) {
      const { data: last } = await ctx.client
        .from("categories")
        .select("position")
        .eq("organization_id", ctx.organizationId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      position = Math.max(0, Number(last?.position ?? 0)) + 1;
    }
    const assessments = payload.assessments
      ? normalizedAssessments(payload)
      : defaultAssessmentsForNewModality(org);

    const { data, error } = await createSupabaseAdminClient()
      .from("categories")
      .insert({
        organization_id: ctx.organizationId,
        name: payload.name.trim(),
        position,
        progression_track: payload.progressionTrack ?? null,
        assessments: assessments ?? null,
        measurements: normalizedMeasurements(payload) ?? null,
        // Sem escolha, o banco poe a primeira cor livre (gatilho da migracao 100).
        color: payload.color ?? null,
        status: payload.status ?? "active",
      })
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) throw duplicateCategoryNameError(noun);
    if (error || !data) throw new Error(error?.message);
    return categoryFromRow(data);
  });
}

export async function updateCategoryAction(
  id: Id,
  payload: UpdateCategory,
): Promise<ActionResult<CategoryUpdateResult>> {
  return runAction(async () => {
    payload = decodeArgs(payload) as UpdateCategory;
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const org = await loadOrganization(ctx);
    const noun = categoryNounFor(org);
    const before = await fetchCategory(ctx, id);
    validateCategoryPayload(payload, { partial: true, noun });
    if (payload.assessments !== undefined && before.assessments) {
      const { data: graded } = await createSupabaseAdminClient()
        .from("assessments")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .eq("modality_id", id)
        .neq("grades", "[]")
        .limit(1);
      assertGradingKept(before.assessments, normalizedAssessments(payload), (graded ?? []).length > 0);
    }

    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name.trim();
    if (payload.position !== undefined) patch.position = payload.position;
    if (payload.progressionTrack !== undefined) patch.progression_track = payload.progressionTrack ?? null;
    if (payload.assessments !== undefined) patch.assessments = normalizedAssessments(payload) ?? null;
    if (payload.measurements !== undefined) patch.measurements = normalizedMeasurements(payload) ?? null;
    if (payload.color !== undefined) patch.color = payload.color ?? null;
    if (payload.status !== undefined) patch.status = payload.status;

    const { data, error } = await createSupabaseAdminClient()
      .from("categories")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) throw duplicateCategoryNameError(noun);
    if (error || !data) throw new Error(error?.message);
    const category = categoryFromRow(data);

    let reset = 0;
    if (payload.progressionTrack !== undefined) {
      reset = await resetStudentsToTrack(ctx, category);
    }
    // Revisar nome ou trilha conta como revisar as modalidades do setup.
    const settings = org.settings;
    if (
      settings?.modalitiesReviewed === false &&
      (payload.name !== undefined || payload.progressionTrack !== undefined)
    ) {
      // So o servidor grava o espaco (migracao 69); o recorte e o da sessao.
      await createSupabaseAdminClient()
        .from("organizations")
        .update({ settings: { ...settings, modalitiesReviewed: true } })
        .eq("id", ctx.organizationId);
    }
    return { category, reset };
  });
}

/** Grava as graduacoes dos alunos que a trilha nova moveu. */
async function resetStudentsToTrack(ctx: TenantContext, category: Category): Promise<number> {
  const { data, error } = await selectAllRows(() =>
    ctx.client.from("clients").select("id, birth_date, progressions").eq("organization_id", ctx.organizationId),
  );
  if (error) throw new Error(error.message);
  const clients = (data ?? [])
    .filter((row) => Boolean((row.progressions as Record<string, unknown> | null)?.[category.id]))
    .map(
    (row) =>
      ({
        id: String(row.id),
        birthDate: (row.birth_date as string | null) ?? undefined,
        progressions: (row.progressions as Client["progressions"]) ?? {},
      }) as Client,
  );
  const { changed, reset } = resetMissingLevels(clients, category, todayInSpace(), new Date().toISOString());
  // Gravacao pelo servidor (chave de servico): o banco nao aceita mais escrita
  // direta em clients pelo usuario (revisao geral de 31/10/2026, achado S3).
  const admin = createSupabaseAdminClient();
  for (const client of changed) {
    const { error: updateError } = await admin
      .from("clients")
      .update({ progressions: client.progressions })
      .eq("id", client.id)
      .eq("organization_id", ctx.organizationId);
    if (updateError) throw new Error(updateError.message);
  }
  return reset;
}

/** Inativacao logica; devolve a modalidade para a auditoria. */
export async function removeCategoryAction(id: Id): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    await fetchCategory(ctx, id);
    const { data, error } = await createSupabaseAdminClient()
      .from("categories")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return categoryFromRow(data);
  });
}
