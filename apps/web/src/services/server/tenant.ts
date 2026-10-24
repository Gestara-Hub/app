import type { Id, Permission, UserProfile } from "@gestarahub/contracts";
import { apiError, forbiddenError } from "@gestarahub/core/api-error";
import { resolveSpaceTimeZone, type SpaceTimeZone } from "@gestarahub/core/date";
import { can } from "@/lib/permissions";
import { setErrorScope } from "@/lib/log/server-sink";
import { secondFactorState } from "@/lib/security/second-factor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missingSecondFactor } from "@/lib/supabase/tenant-client";

/**
 * Contexto do espaco na server action (doc 15, fatia 2). O espaco e o perfil
 * saem do usuario autenticado no Supabase, nunca de argumento vindo do
 * navegador, e o cliente e o da sessao (com RLS). Sem sessao valida nao ha
 * fallback para o cliente administrativo. Com a verificacao em duas etapas
 * ligada, a sessao precisa ter passado pelo segundo fator (doc 17): a mesma
 * barreira de `getClientForTenant`. Modulo so do servidor, sem
 * "use server": nao vira action.
 */

export type TenantClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface TenantContext {
  client: TenantClient;
  organizationId: Id;
  userId: Id;
  profile: UserProfile;
  professionalId?: Id;
  /** Fuso do espaco (achado 60): o "hoje" das regras e do parceiro de pagamentos. */
  timeZone: SpaceTimeZone;
  /** Lanca FORBIDDEN se o perfil nao tem nenhuma das permissoes. */
  require(...permissions: Permission[]): void;
}

function unauthorized() {
  return apiError("FORBIDDEN", "Sua sessão expirou. Entre de novo.", { httpStatus: 401 });
}

export async function requireTenant(): Promise<TenantContext> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw unauthorized();
  if ((await secondFactorState(client, user)) === "missing") throw missingSecondFactor();

  const { data: row, error } = await client
    .from("users")
    .select("id, organization_id, profile, professional_id, organizations(settings, units(address))")
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !row) throw unauthorized();

  const profile = row.profile as UserProfile;
  const organization = (row.organizations ?? null) as {
    settings?: { timeZone?: string } | null;
    units?: { address?: { state?: string } | string | null }[];
  } | null;
  const timeZone = resolveSpaceTimeZone(organization?.settings, organization?.units?.[0]?.address);
  // Erros registrados dentro desta requisicao saem com o espaco e o usuario da
  // sessao; o "hoje" da acao sai do fuso do espaco.
  setErrorScope({ organizationId: String(row.organization_id), userId: String(row.id), timeZone });
  return {
    client,
    organizationId: String(row.organization_id),
    userId: String(row.id),
    profile,
    professionalId: row.professional_id ? String(row.professional_id) : undefined,
    timeZone,
    require(...permissions) {
      if (!permissions.some((p) => can(profile, p))) throw forbiddenError();
    },
  };
}

/**
 * Para actions antigas que recebem o espaco por parametro: confere que quem
 * chama esta logado nesse espaco e tem uma das permissoes (ou o perfil pedido).
 */
export async function requireSameOrganization(
  organizationId: string,
  options: { permissions?: Permission[]; profiles?: UserProfile[] } = {},
): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (ctx.organizationId !== organizationId) throw forbiddenError();
  if (options.permissions?.length) ctx.require(...options.permissions);
  if (options.profiles?.length && !options.profiles.includes(ctx.profile)) throw forbiddenError();
  return ctx;
}
