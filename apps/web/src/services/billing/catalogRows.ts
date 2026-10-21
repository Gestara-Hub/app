import type { LessonPackage, Plan } from "@gestarahub/contracts";

/** Linhas de planos e do catalogo de pacotes no contrato. */

function iso(value: unknown): string {
  return value ? new Date(String(value)).toISOString() : new Date().toISOString();
}

export function planFromRow(row: Record<string, unknown>): Plan {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    priceCents: typeof row.price_cents === "number" ? row.price_cents : 0,
    period: (row.period as Plan["period"]) || "monthly",
    status: (row.status as Plan["status"]) || "active",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function lessonPackageFromRow(row: Record<string, unknown>): LessonPackage {
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function lessonPackageToRow(pkg: Omit<LessonPackage, "id" | "createdAt" | "updatedAt">) {
  return {
    organization_id: pkg.organizationId,
    name: pkg.name.trim(),
    lessons: pkg.lessons,
    price_cents: pkg.priceCents,
    validity_days: pkg.validityDays ?? null,
    class_group_ids: pkg.classGroupIds ?? [],
    modality_ids: pkg.modalityIds ?? [],
    absence_consumes: pkg.absenceConsumes ?? true,
    status: pkg.status,
  };
}
