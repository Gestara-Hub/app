"use server";

import type { Organization, Unit } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

/**
 * Persistencia das Configuracoes (espaco e unidade) no Supabase. O setup
 * inicial grava por `persistSetupToBackendAction`; estas funcoes cobrem as
 * edicoes feitas depois, em Configuracoes > Geral e Horarios.
 */

export async function updateOrganizationInDb(organization: Organization): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("organizations")
    .update({
      name: organization.name,
      segment: organization.segment,
      model: organization.model,
      class_segment: organization.classSegment ?? null,
      custom_segment_name: organization.customSegmentName ?? null,
      custom_segment_progression: organization.customSegmentProgression ?? null,
      custom_segment_billing: organization.customSegmentBilling ?? null,
      settings: organization.settings ?? {},
    })
    .eq("id", organization.id);

  if (error) {
    console.error("[settingsBackend] Erro ao atualizar organização:", error);
    throw new Error("Erro ao salvar os dados do espaço no banco de dados.");
  }
}

export async function updateUnitInDb(unit: Unit): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("units")
    .update({
      name: unit.name,
      address: unit.address ?? null,
      phone: unit.phone ?? null,
      business_hours: unit.businessHours ?? [],
      status: unit.status,
    })
    .eq("organization_id", unit.organizationId)
    .eq("id", unit.id);

  if (error) {
    console.error("[settingsBackend] Erro ao atualizar unidade:", error);
    throw new Error("Erro ao salvar os dados da unidade no banco de dados.");
  }
}
