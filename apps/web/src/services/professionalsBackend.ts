"use server";

import type {
  Id,
  Professional,
  ProfessionalFilter,
  UpdateProfessional,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

function mapRowToProfessional(row: Record<string, unknown>): Professional {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: String(row.unit_id),
    name: String(row.name),
    roleId: row.role_id ? String(row.role_id) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    address: (row.address as Professional["address"]) || undefined,
    status: (row.status as Professional["status"]) || "active",
    workingHours: (row.working_hours as Professional["workingHours"]) || [],
    serviceIds: (row.service_ids as Professional["serviceIds"]) || [],
    modalityIds: (row.modality_ids as Professional["modalityIds"]) || undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

export async function listProfessionalsFromDb(
  organizationId: string,
  filter?: ProfessionalFilter,
): Promise<Professional[]> {
  const client = await getClientForTenant();
  let query = client
    .from("professionals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[professionalsBackend] Erro ao listar profissionais:", error);
    throw new Error("Erro ao consultar profissionais no banco de dados.");
  }

  let result = (data || []).map(mapRowToProfessional);
  if (filter?.search) {
    const term = filter.search.toLowerCase().trim();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.email ? p.email.toLowerCase().includes(term) : false),
    );
  }
  if (filter?.serviceId) {
    result = result.filter((p) => p.serviceIds.includes(filter.serviceId!));
  }

  return result;
}

export async function getProfessionalFromDb(
  id: Id,
  organizationId: string,
): Promise<Professional | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("professionals")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[professionalsBackend] Erro ao buscar profissional:", error);
    throw new Error("Erro ao consultar profissional no banco de dados.");
  }

  return data ? mapRowToProfessional(data) : null;
}

export async function createProfessionalInDb(
  professional: Professional,
): Promise<Professional> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("professionals")
    .insert({
      id: professional.id,
      organization_id: professional.organizationId,
      unit_id: professional.unitId,
      name: professional.name.trim(),
      role_id: professional.roleId ?? null,
      email: professional.email?.trim() || null,
      phone: professional.phone?.trim() ?? null,
      address: professional.address ?? null,
      status: professional.status,
      working_hours: professional.workingHours ?? [],
      service_ids: professional.serviceIds ?? [],
      modality_ids: professional.modalityIds ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[professionalsBackend] Erro ao criar profissional:", error);
    throw new Error("Erro ao salvar profissional no banco de dados.");
  }

  return mapRowToProfessional(data);
}

export async function updateProfessionalInDb(
  id: Id,
  payload: UpdateProfessional,
  organizationId: string,
): Promise<Professional> {
  const client = await getClientForTenant();
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.roleId !== undefined) updateData.role_id = payload.roleId || null;
  if (payload.email !== undefined) updateData.email = payload.email?.trim() || null;
  if (payload.phone !== undefined) updateData.phone = payload.phone?.trim() || null;
  if (payload.address !== undefined) updateData.address = payload.address || null;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.workingHours !== undefined) updateData.working_hours = payload.workingHours;
  if (payload.serviceIds !== undefined) updateData.service_ids = payload.serviceIds;
  if (payload.modalityIds !== undefined) updateData.modality_ids = payload.modalityIds;

  const { data, error } = await client
    .from("professionals")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[professionalsBackend] Erro ao atualizar profissional:", error);
    throw new Error("Erro ao atualizar profissional no banco de dados.");
  }

  return mapRowToProfessional(data);
}

export async function inactivateProfessionalInDb(
  id: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("professionals")
    .update({ status: "inactive" })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[professionalsBackend] Erro ao inativar profissional:", error);
    throw new Error("Erro ao inativar profissional no banco de dados.");
  }
}
