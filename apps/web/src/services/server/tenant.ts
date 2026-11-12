import type { AuditActor, Id, Permission, UserProfile } from "@gestarahub/contracts";
import { requestRoute } from "./requestRoute";
import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { apiError, forbiddenError } from "@gestarahub/core/api-error";
import { resolveSpaceTimeZone, type SpaceTimeZone } from "@gestarahub/core/date";
import { can } from "@/lib/permissions";
import { setErrorScope } from "@/lib/log/server-sink";
import { isPlatformAdminUser } from "@/lib/security/platform-admin";
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
  /** Autor fixo, sem pessoa (rotina, inscricao pelo link): vale no lugar do usuario. */
  actor?: AuditActor;
  /** Lanca FORBIDDEN se o perfil nao tem nenhuma das permissoes. */
  require(...permissions: Permission[]): void;
}

function unauthorized() {
  return apiError("FORBIDDEN", "Sua sessão expirou. Entre de novo.", { httpStatus: 401 });
}

function authUnavailable() {
  return apiError("NETWORK", "O sistema está com muita gente agora. Tente de novo em instantes.", { httpStatus: 503 });
}

/** Rede, 5xx ou limite de pedidos do Auth: tentar de novo resolve; sessao invalida nao. */
export function isTransientAuthError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (isAuthApiError(error)) return error.status === 429 || error.status >= 500;
  return false;
}

const USER_ROW_FIELDS =
  "id, auth_user_id, organization_id, profile, professional_id, organizations(status, settings, subscription, units(address))";

function userRowOf(client: TenantClient, authUserId: string) {
  return client
    .from("users")
    .select(USER_ROW_FIELDS)
    .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
}

/** A linha do usuario e a da pessoa que o Auth confirmou. */
function rowBelongsTo(row: { id?: unknown; auth_user_id?: unknown } | null, authUserId: string): boolean {
  return Boolean(row) && (String(row?.auth_user_id ?? "") === authUserId || String(row?.id ?? "") === authUserId);
}

export async function requireTenant(): Promise<TenantContext> {
  const client = await createSupabaseServerClient();
  // Login e perfil ao mesmo tempo (12/11/2026): antes, a linha do usuario so
  // era buscada depois da resposta do Auth (duas idas seguidas por chamada).
  // A sessao local (do cookie, renovada aqui se vencida, uma vez so) da o id
  // para a busca; o RLS confere o token no banco, e a linha so vale se for da
  // pessoa que o `getUser` confirmou. Se nao for, busca de novo pelo id certo.
  const {
    data: { session },
  } = await client.auth.getSession();
  const claimedId = session?.user?.id;
  const [
    {
      data: { user },
      error: authError,
    },
    early,
  ] = await Promise.all([client.auth.getUser(), claimedId ? userRowOf(client, claimedId) : Promise.resolve(null)]);
  // Falha passageira do servico de login (rede, sobrecarga, limite): nao e
  // sessao vencida. Antes virava "Sua sessão expirou" e mandava para o login
  // (pico de 100 chamadas simultaneas, 11/11/2026); agora pede para tentar de novo.
  if (!user && authError && isTransientAuthError(authError)) throw authUnavailable();
  if (!user || isPlatformAdminUser(user)) throw unauthorized();
  if ((await secondFactorState(client, user)) === "missing") throw missingSecondFactor();

  const { data: row, error } =
    early && !early.error && rowBelongsTo(early.data, user.id) ? early : await userRowOf(client, user.id);
  if (error || !row || !rowBelongsTo(row, user.id)) throw unauthorized();

  const profile = row.profile as UserProfile;
  const organization = (row.organizations ?? null) as {
    status?: string;
    settings?: { timeZone?: string } | null;
    subscription?: { tier?: string } | null;
    units?: { address?: { state?: string } | string | null }[];
  } | null;
  // Espaco inativado pelo painel: nenhuma acao passa (a sessao tambem acaba em getCurrentUser).
  if (organization?.status && organization.status !== "active") throw unauthorized();
  const timeZone = resolveSpaceTimeZone(organization?.settings, organization?.units?.[0]?.address);
  // Erros registrados dentro desta requisicao saem com o espaco e o usuario da
  // sessao; o "hoje" da acao sai do fuso do espaco.
  setErrorScope({ organizationId: String(row.organization_id), userId: String(row.id), timeZone, profile, tier: organization?.subscription?.tier ?? "free", route: await requestRoute() });
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
