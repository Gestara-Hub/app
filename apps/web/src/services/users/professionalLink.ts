import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vinculo usuario x instrutor (05/11/2026, doc product/06): o vinculo diz quem
 * e a pessoa (o login e ela na equipe), entao:
 * - um instrutor tem no maximo um usuario ATIVO (indice da migracao 89);
 *   reativar um usuario cujo instrutor ja foi ligado a outro ativo e recusado;
 * - depois que a conta foi ativada (convite aceito), o instrutor ligado nao
 *   muda. Para corrigir, inativa e convida de novo. Usuario sem vinculo pode
 *   ser ligado uma vez.
 * Modulo so do servidor (sem "use server"): usado pelas actions de usuarios.
 */

export const PROFESSIONAL_LINK_LOCKED =
  "O profissional vinculado não muda depois que a conta foi ativada. Para corrigir, inative este usuário e convide de novo.";

export function professionalTakenMessage(userName: string, reactivating: boolean): string {
  return reactivating
    ? `Não dá para reativar: este profissional já está ligado ao usuário ${userName}.`
    : `Este profissional já está ligado ao usuário ${userName}.`;
}

/** Outro usuario ativo ligado ao mesmo instrutor (nome dele), ou null. */
export async function activeUserLinkedTo(
  admin: SupabaseClient,
  organizationId: string,
  professionalId: string,
  exceptUserId?: string,
): Promise<string | null> {
  let query = admin
    .from("users")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("professional_id", professionalId)
    .eq("status", "active")
    .limit(1);
  if (exceptUserId) query = query.neq("id", exceptUserId);
  const { data } = await query;
  return data?.[0] ? String(data[0].name) : null;
}

/** Violacao do indice uq_users_active_professional (corrida entre duas gravacoes). */
export function isProfessionalUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && error.code === "23505" && (error.message ?? "").includes("uq_users_active_professional"));
}
