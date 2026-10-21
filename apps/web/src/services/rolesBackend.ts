"use server";

import type { Id, Role } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

/**
 * Cargos da equipe no Supabase (doc 15, fatia 1). O nome e unico por
 * organizacao sem acento nem caixa (`uq_roles_organization_name`, migracao 28):
 * a violacao volta como `{ duplicate: true }` para o servico dar a mensagem.
 */

export type RoleWriteResult = { role: Role } | { duplicate: true };

const UNIQUE_VIOLATION = "23505";

function mapRowToRole(row: Record<string, unknown>): Role {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    position: typeof row.position === "number" ? row.position : 0,
    status: (row.status as Role["status"]) || "active",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listRolesFromDb(organizationId: string): Promise<Role[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("roles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[rolesBackend] Erro ao listar cargos:", error);
    throw new Error("Erro ao consultar cargos no banco de dados.");
  }
  return (data || []).map(mapRowToRole);
}

export async function createRoleInDb(role: Role): Promise<RoleWriteResult> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("roles")
    .insert({
      id: role.id,
      organization_id: role.organizationId,
      name: role.name,
      position: role.position,
      status: role.status,
    })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { duplicate: true };
  if (error || !data) {
    console.error("[rolesBackend] Erro ao criar cargo:", error);
    throw new Error("Erro ao salvar cargo no banco de dados.");
  }
  return { role: mapRowToRole(data) };
}

export async function updateRoleInDb(
  id: Id,
  organizationId: string,
  patch: Partial<Pick<Role, "name" | "position" | "status">>,
): Promise<RoleWriteResult> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("roles")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) return { duplicate: true };
  if (error) {
    console.error("[rolesBackend] Erro ao atualizar cargo:", error);
    throw new Error("Erro ao salvar cargo no banco de dados.");
  }
  if (!data) throw new Error("Cargo não encontrado.");
  return { role: mapRowToRole(data) };
}
