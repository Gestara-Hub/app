import { resolveSpaceTimeZone } from "@gestarahub/core/date";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantClient, TenantContext } from "./tenant";

/**
 * Contexto de um espaco sem pessoa logada (doc product/29, inscricao pelo
 * link; rotinas): chave de servico, perfil de dono (sem recorte de professor)
 * e um autor fixo na Auditoria ("Inscrição pelo link", "Rotina de pagamentos
 * online"). Quem chama ja conferiu o que pode (rota publica com travas, rotina
 * com o segredo). Modulo so do servidor.
 */
export async function systemTenantContext(organizationId: string, actorName: string): Promise<TenantContext> {
  const admin = createSupabaseAdminClient();
  const [{ data: org }, { data: unit }] = await Promise.all([
    admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle(),
    admin.from("units").select("address").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);
  return {
    client: admin as unknown as TenantClient,
    organizationId,
    userId: "system",
    profile: "owner",
    timeZone: resolveSpaceTimeZone(org?.settings as { timeZone?: string } | undefined, unit?.address),
    actor: { kind: "system", userId: "system", name: actorName, profile: "owner" },
    require: () => undefined,
  };
}
