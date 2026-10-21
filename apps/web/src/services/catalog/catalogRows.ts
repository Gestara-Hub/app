import type { Category, Professional, Role } from "@gestarahub/contracts";

/** Linhas do catalogo (modalidades, equipe, cargos) no contrato. */

function iso(value: unknown): string {
  return value ? new Date(String(value)).toISOString() : new Date().toISOString();
}

export function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    position: typeof row.position === "number" ? row.position : 0,
    progressionTrack: (row.progression_track as Category["progressionTrack"]) || undefined,
    assessments: (row.assessments as Category["assessments"]) || undefined,
    status: (row.status as Category["status"]) || "active",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function roleFromRow(row: Record<string, unknown>): Role {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    position: typeof row.position === "number" ? row.position : 0,
    status: (row.status as Role["status"]) || "active",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function professionalFromRow(row: Record<string, unknown>): Professional {
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
