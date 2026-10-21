"use server";

import type { CertificateTemplate } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

/**
 * Modelo do certificado no Supabase (doc 15, fatia 1): coluna
 * `organizations.certificate_template`; null = modelo padrao. A logo fica no
 * bucket privado `attachments` (rota /api/attachments) e o modelo guarda o id.
 */

export async function getCertificateTemplateFromDb(
  organizationId: string,
): Promise<CertificateTemplate | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("organizations")
    .select("certificate_template")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) {
    console.error("[certificatesBackend] Erro ao ler o modelo do certificado:", error);
    throw new Error("Erro ao consultar o modelo do certificado no banco de dados.");
  }
  return (data?.certificate_template as CertificateTemplate | null) ?? null;
}

/** Grava o modelo (null volta ao padrao). */
export async function saveCertificateTemplateInDb(
  organizationId: string,
  template: CertificateTemplate | null,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("organizations")
    .update({ certificate_template: template })
    .eq("id", organizationId);
  if (error) {
    console.error("[certificatesBackend] Erro ao salvar o modelo do certificado:", error);
    throw new Error("Erro ao salvar o modelo do certificado no banco de dados.");
  }
}
