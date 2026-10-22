"use server";

import type {
  CreateProfessional,
  CreateRole,
  Id,
  Professional,
  ProfessionalFilter,
  ProfessionalView,
  Role,
  RoleFilter,
  UpdateProfessional,
  UpdateRole,
} from "@gestarahub/contracts";
import { notFoundError } from "@gestarahub/core/api-error";
import { textIncludes } from "@/lib/text";
import { runAction, type ActionResult } from "../server/action";
import { decodeArgs } from "../world/transport";
import { loadUnit, UNIQUE_VIOLATION } from "../server/organization";
import { requireTenant, type TenantContext } from "../server/tenant";
import { professionalFromRow, roleFromRow } from "./catalogRows";
import {
  duplicateRoleNameError,
  PROFESSIONAL_NOT_FOUND,
  ROLE_NOT_FOUND,
  sortProfessionals,
  sortRoles,
  toProfessionalView,
  validateProfessionalPayload,
  validateRolePayload,
} from "./teamRules";

/**
 * Equipe e cargos da conta real (doc 15, fatia 2.1): banco com o espaco da
 * sessao e as mesmas regras da demonstracao (`teamRules`).
 */

const MANAGE = ["team:manage"] as const;

async function fetchRoles(ctx: TenantContext): Promise<Role[]> {
  const { data, error } = await ctx.client
    .from("roles")
    .select("*")
    .eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  return sortRoles((data ?? []).map(roleFromRow));
}

async function fetchRole(ctx: TenantContext, id: Id): Promise<Role> {
  const { data, error } = await ctx.client
    .from("roles")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFoundError(ROLE_NOT_FOUND);
  return roleFromRow(data);
}

async function fetchProfessional(ctx: TenantContext, id: Id): Promise<Professional> {
  const { data, error } = await ctx.client
    .from("professionals")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFoundError(PROFESSIONAL_NOT_FOUND);
  return professionalFromRow(data);
}

// --- Cargos ------------------------------------------------------------------

export async function listRolesAction(filter?: RoleFilter): Promise<ActionResult<Role[]>> {
  return runAction(async () => {
    let roles = await fetchRoles(await requireTenant());
    if (filter?.search) roles = roles.filter((r) => textIncludes(r.name, filter.search!));
    if (filter?.status) roles = roles.filter((r) => r.status === filter.status);
    return roles;
  });
}

export async function getRoleAction(id: Id): Promise<ActionResult<Role>> {
  return runAction(async () => fetchRole(await requireTenant(), id));
}

export async function createRoleAction(payload: CreateRole): Promise<ActionResult<Role>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    validateRolePayload(payload, { partial: false });
    const position =
      payload.position ?? Math.max(0, ...(await fetchRoles(ctx)).map((r) => r.position)) + 1;
    const { data, error } = await ctx.client
      .from("roles")
      .insert({
        organization_id: ctx.organizationId,
        name: payload.name.trim(),
        position,
        status: payload.status ?? "active",
      })
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) throw duplicateRoleNameError();
    if (error || !data) throw new Error(error?.message);
    return roleFromRow(data);
  });
}

export interface RoleUpdateResult {
  role: Role;
  previousStatus: Role["status"];
}

export async function updateRoleAction(id: Id, payload: UpdateRole): Promise<ActionResult<RoleUpdateResult>> {
  return runAction(async () => {
    payload = decodeArgs(payload) as UpdateRole;
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const current = await fetchRole(ctx, id);
    validateRolePayload(payload, { partial: true });
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name.trim();
    if (payload.position !== undefined) patch.position = payload.position;
    if (payload.status !== undefined) patch.status = payload.status;
    const { data, error } = await ctx.client
      .from("roles")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) throw duplicateRoleNameError();
    if (error || !data) throw new Error(error?.message);
    return { role: roleFromRow(data), previousStatus: current.status };
  });
}

/** Inativacao logica. */
export async function removeRoleAction(id: Id): Promise<ActionResult<Role>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    await fetchRole(ctx, id);
    const { data, error } = await ctx.client
      .from("roles")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return roleFromRow(data);
  });
}

// --- Equipe ------------------------------------------------------------------

export async function listProfessionalsAction(
  filter?: ProfessionalFilter,
): Promise<ActionResult<ProfessionalView[]>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    let query = ctx.client.from("professionals").select("*").eq("organization_id", ctx.organizationId);
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.serviceId) query = query.contains("service_ids", [filter.serviceId]);
    const [{ data, error }, roles] = await Promise.all([query, fetchRoles(ctx)]);
    if (error) throw new Error(error.message);
    let views = (data ?? []).map((row) => toProfessionalView(professionalFromRow(row), roles));
    if (filter?.search) {
      const term = filter.search;
      views = views.filter(
        (p) =>
          textIncludes(p.name, term) ||
          (p.email ? textIncludes(p.email, term) : false) ||
          (p.role ? textIncludes(p.role.name, term) : false),
      );
    }
    return sortProfessionals(views);
  });
}

export async function getProfessionalAction(id: Id): Promise<ActionResult<ProfessionalView>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    const [professional, roles] = await Promise.all([fetchProfessional(ctx, id), fetchRoles(ctx)]);
    return toProfessionalView(professional, roles);
  });
}

async function roleChecker(ctx: TenantContext, roleId: string | undefined) {
  if (!roleId) return () => true;
  const roles = await fetchRoles(ctx);
  return (id: string) => roles.some((r) => r.id === id);
}

export async function createProfessionalAction(
  payload: CreateProfessional,
): Promise<ActionResult<ProfessionalView>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    validateProfessionalPayload(payload, { partial: false, roleExists: await roleChecker(ctx, payload.roleId) });
    const unit = await loadUnit(ctx);
    const { data, error } = await ctx.client
      .from("professionals")
      .insert({
        organization_id: ctx.organizationId,
        // A unidade vem do espaco da sessao, nunca de um id da tela.
        unit_id: unit.id,
        name: payload.name.trim(),
        role_id: payload.roleId || null,
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        address: payload.address ?? null,
        status: payload.status ?? "active",
        working_hours: payload.workingHours ?? [],
        service_ids: payload.serviceIds ?? [],
        modality_ids: payload.modalityIds ?? [],
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return toProfessionalView(professionalFromRow(data), await fetchRoles(ctx));
  });
}

export interface ProfessionalUpdateResult {
  professional: ProfessionalView;
  previousStatus: Professional["status"];
}

export async function updateProfessionalAction(
  id: Id,
  payload: UpdateProfessional,
): Promise<ActionResult<ProfessionalUpdateResult>> {
  return runAction(async () => {
    payload = decodeArgs(payload) as UpdateProfessional;
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    const current = await fetchProfessional(ctx, id);
    validateProfessionalPayload(payload, { partial: true, roleExists: await roleChecker(ctx, payload.roleId) });
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name.trim();
    if (payload.roleId !== undefined) patch.role_id = payload.roleId || null;
    if (payload.email !== undefined) patch.email = payload.email?.trim() || null;
    if (payload.phone !== undefined) patch.phone = payload.phone?.trim() || null;
    if (payload.address !== undefined) patch.address = payload.address || null;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.workingHours !== undefined) patch.working_hours = payload.workingHours;
    if (payload.serviceIds !== undefined) patch.service_ids = payload.serviceIds;
    if (payload.modalityIds !== undefined) patch.modality_ids = payload.modalityIds;
    const { data, error } = await ctx.client
      .from("professionals")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return {
      professional: toProfessionalView(professionalFromRow(data), await fetchRoles(ctx)),
      previousStatus: current.status,
    };
  });
}

/** Inativacao logica. */
export async function removeProfessionalAction(id: Id): Promise<ActionResult<Professional>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require(...MANAGE);
    await fetchProfessional(ctx, id);
    const { data, error } = await ctx.client
      .from("professionals")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message);
    return professionalFromRow(data);
  });
}
