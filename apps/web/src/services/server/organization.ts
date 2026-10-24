import type {
  ClassBillingMode,
  ClassesBusinessSegment,
  CustomSegmentProgression,
  OperationalModel,
  Organization,
  Unit,
} from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import type { TenantContext } from "./tenant";

/** Linha de `organizations` no contrato (sem as tarifas da subconta). */
export function organizationFromRow(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: (row.name as string) ?? "Meu espaço",
    segment: (row.segment as string) ?? "Academia",
    model: (row.model as OperationalModel) ?? "classes",
    classSegment: (row.class_segment as ClassesBusinessSegment | null) ?? undefined,
    customSegmentName: (row.custom_segment_name as string | null) ?? undefined,
    customSegmentProgression: (row.custom_segment_progression as CustomSegmentProgression | null) ?? undefined,
    customSegmentBilling: (row.custom_segment_billing as ClassBillingMode | null) ?? undefined,
    settings: (row.settings as Organization["settings"]) ?? { defaultDueDay: 10 },
    subscription: (row.subscription as Organization["subscription"]) ?? { tier: "free" },
    status: (row.status as Organization["status"]) ?? "active",
  };
}

export function unitFromRow(row: Record<string, unknown>): Unit {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: (row.name as string) ?? "",
    address: (row.address as Unit["address"]) ?? undefined,
    phone: (row.phone as string | null) ?? undefined,
    status: (row.status as Unit["status"]) ?? "active",
    businessHours: (row.business_hours as Unit["businessHours"]) ?? [],
  };
}

/** Espaco da sessao. */
export async function loadOrganization(ctx: TenantContext): Promise<Organization> {
  const { data, error } = await ctx.client
    .from("organizations")
    .select("*")
    .eq("id", ctx.organizationId)
    .single();
  if (error || !data) throw new Error(`Espaço não encontrado: ${error?.message ?? ""}`);
  return organizationFromRow(data);
}

/** Unidade do espaco (o modelo de turmas tem uma so). */
export async function loadUnit(ctx: TenantContext): Promise<Unit> {
  const { data, error } = await ctx.client
    .from("units")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Unidade não encontrada: ${error?.message ?? ""}`);
  return unitFromRow(data);
}

/** Data de hoje no fuso do espaco da requisicao, nao no do servidor. */
export function todayInSpace(): string {
  return dateInSpace();
}

/** Erro do Postgres de indice unico. */
export const UNIQUE_VIOLATION = "23505";
