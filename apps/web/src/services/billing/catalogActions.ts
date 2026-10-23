"use server";

import { selectAllRows } from "@/lib/supabase/select-all";
import type {
  ClassGroup,
  CreateLessonPackage,
  CreatePlan,
  Id,
  LessonPackage,
  LessonPackageFilter,
  Plan,
  PlanFilter,
  UpdateLessonPackage,
  UpdatePlan,
} from "@gestarahub/contracts";
import { notFoundError } from "@gestarahub/core/api-error";
import { textIncludes } from "@/lib/text";
import { runAction, type ActionResult } from "../server/action";
import { decodeArgs } from "../world/transport";
import { requireTenant, type TenantContext } from "../server/tenant";
import { normalizePackage, validatePackage, validatePlan } from "./billingValidation";
import { lessonPackageFromRow, lessonPackageToRow, planFromRow } from "./catalogRows";
import { activeStudentsInPlan, periodChangeError, sortByName } from "./planRules";

/**
 * Planos e catalogo de pacotes da conta real (doc 15, fatia 2.1): banco com o
 * espaco da sessao e as mesmas regras da demonstracao.
 */

const MANAGE = ["billing:manage"] as const;

/** Antes e depois, para a auditoria do navegador. */
export interface CatalogUpdate<T> {
  before: T;
  after: T;
}

async function fetchPlan(ctx: TenantContext, id: Id): Promise<Plan> {
  const { data, error } = await ctx.client
    .from("plans")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFoundError("Plano não encontrado.");
  return planFromRow(data);
}

async function fetchPackage(ctx: TenantContext, id: Id): Promise<LessonPackage> {
  const { data, error } = await ctx.client
    .from("lesson_packages")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFoundError("Pacote não encontrado.");
  return lessonPackageFromRow(data);
}

async function classGroupsForPackages(ctx: TenantContext) {
  const { data, error } = await ctx.client
    .from("class_groups")
    .select("id, billing_mode")
    .eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({
    id: String(g.id),
    billingMode: (g.billing_mode as ClassGroup["billingMode"]) ?? undefined,
  }));
}

// --- Planos ------------------------------------------------------------------

export async function listPlansAction(filter?: PlanFilter): Promise<ActionResult<Plan[]>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    let query = ctx.client.from("plans").select("*").eq("organization_id", ctx.organizationId);
    if (filter?.period) query = query.eq("period", filter.period);
    if (filter?.status) query = query.eq("status", filter.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    let plans = (data ?? []).map(planFromRow);
    if (filter?.search) plans = plans.filter((p) => textIncludes(p.name, filter.search!));
    return sortByName(plans);
  });
}

export async function createPlanAction(payload: CreatePlan): Promise<ActionResult<Plan>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    validatePlan(payload);
    const { data, error } = await ctx.client
      .from("plans")
      .insert({
        organization_id: ctx.organizationId,
        name: payload.name.trim(),
        price_cents: payload.priceCents,
        period: payload.period || "monthly",
        status: payload.status ?? "active",
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return planFromRow(data);
  });
}

async function activeStudentsOfPlan(ctx: TenantContext, planId: Id): Promise<number> {
  const org = ctx.organizationId;
  const [clients, enrollments, groups] = await Promise.all([
    selectAllRows(() => ctx.client.from("clients").select("id, status, plan_id").eq("organization_id", org).eq("status", "active")),
    selectAllRows(() =>
      ctx.client
        .from("enrollments")
        .select("status, class_group_id, student_id, pays_with_package")
        .eq("organization_id", org)
        .eq("status", "active"),
    ),
    ctx.client.from("class_groups").select("id, plan_id, billing_mode").eq("organization_id", org),
  ]);
  for (const r of [clients, enrollments, groups]) if (r.error) throw new Error(r.error.message);
  return activeStudentsInPlan(
    {
      clients: (clients.data ?? []).map((c) => ({
        id: String(c.id),
        status: c.status as "active",
        planId: c.plan_id ? String(c.plan_id) : undefined,
      })),
      enrollments: (enrollments.data ?? []).map((e) => ({
        status: e.status as "active",
        classGroupId: String(e.class_group_id),
        studentId: String(e.student_id),
        paysWithPackage: Boolean(e.pays_with_package),
      })),
      classGroups: (groups.data ?? []).map((g) => ({
        id: String(g.id),
        planId: g.plan_id ? String(g.plan_id) : undefined,
        billingMode: (g.billing_mode as ClassGroup["billingMode"]) ?? undefined,
      })),
    },
    planId,
  );
}

export async function updatePlanAction(id: Id, payload: UpdatePlan): Promise<ActionResult<CatalogUpdate<Plan>>> {
  return runAction(async () => {
    payload = decodeArgs(payload) as UpdatePlan;
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const before = await fetchPlan(ctx, id);
    validatePlan({ ...before, ...payload });
    if (payload.period && payload.period !== before.period && (await activeStudentsOfPlan(ctx, id)) > 0) {
      throw periodChangeError();
    }
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name.trim();
    if (payload.priceCents !== undefined) patch.price_cents = payload.priceCents;
    if (payload.period !== undefined) patch.period = payload.period;
    if (payload.status !== undefined) patch.status = payload.status;
    const { data, error } = await ctx.client
      .from("plans")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return { before, after: planFromRow(data) };
  });
}

// --- Catalogo de pacotes -----------------------------------------------------

export async function listPackagesAction(filter?: LessonPackageFilter): Promise<ActionResult<LessonPackage[]>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    let query = ctx.client.from("lesson_packages").select("*").eq("organization_id", ctx.organizationId);
    if (filter?.status) query = query.eq("status", filter.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    let packages = (data ?? []).map(lessonPackageFromRow);
    if (filter?.search) packages = packages.filter((p) => textIncludes(p.name, filter.search!));
    return sortByName(packages);
  });
}

export async function createPackageAction(input: CreateLessonPackage): Promise<ActionResult<LessonPackage>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const payload = normalizePackage(input);
    validatePackage(payload, await classGroupsForPackages(ctx));
    const { data, error } = await ctx.client
      .from("lesson_packages")
      .insert(
        lessonPackageToRow({
          ...payload,
          name: payload.name ?? "",
          status: payload.status ?? "active",
          organizationId: ctx.organizationId,
        }),
      )
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return lessonPackageFromRow(data);
  });
}

/** Mudar o pacote vale para as proximas vendas; o que ja foi vendido fica como esta. */
export async function updatePackageAction(
  id: Id,
  payload: UpdateLessonPackage,
): Promise<ActionResult<CatalogUpdate<LessonPackage>>> {
  return runAction(async () => {
    payload = decodeArgs(payload) as UpdateLessonPackage;
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const before = await fetchPackage(ctx, id);
    const next = normalizePackage({ ...before, ...payload });
    validatePackage(next, await classGroupsForPackages(ctx));
    const { data, error } = await ctx.client
      .from("lesson_packages")
      .update(lessonPackageToRow({ ...before, ...next, name: next.name ?? before.name }))
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return { before, after: lessonPackageFromRow(data) };
  });
}
