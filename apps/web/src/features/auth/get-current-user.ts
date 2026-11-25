import { cache } from "react";
import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEFAULT_SPACE_TIME_ZONE, resolveSpaceTimeZone, type SpaceTimeZone } from "@gestarahub/core/date";
import { SESSION_COOKIE, isSupabaseOrganization } from "@/lib/session";
import { decodeSession } from "@/lib/session-cookie";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSessionClaims } from "@/lib/supabase/session-claims";
import { isGoogleOnlyAccount } from "@/lib/security/two-factor-rules";
import { store } from "@/mocks/store";
import type { SubscriptionTier, UserProfile, UserView } from "@gestarahub/contracts";

/**
 * Resolve o usuario logado no SERVER. Server-only (usa `next/headers`).
 *
 * Caminho principal: le as claims do cookie (o snapshot `UserView` gravado no
 * login). Nao depende do store — os usuarios criados na UI vivem so no navegador,
 * entao a sessao carrega o proprio usuario. Espelha o futuro token assinado (JWT).
 *
 * Fallback legado: cookies antigos (e o forjar de smoke-test/`curl`) guardam so
 * o `userId` puro. Nesse caso resolvemos pelo seed do store — os unicos usuarios
 * que o server enxerga sem claims.
 */
export async function getCurrentUser(): Promise<UserView | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const claims = decodeSession(raw);
  if (claims) {
    if (!isSupabaseOrganization(claims.organizationId)) return claims;
    // Conta real: o usuario ainda existe e esta ativo no espaco? Inativado ou
    // removido, a sessao acaba (antes seguia navegando so com o cookie).
    const space = await loadSessionSpace(claims.id, claims.organizationId);
    if (!space.active) return null;
    // O perfil vale o do banco, nao o do cookie (revisao geral de 31/10/2026):
    // quem mudou de perfil nao segue com o antigo ate o cookie ser regravado.
    return space.profile ? { ...claims, profile: space.profile } : claims;
  }

  // Legado: `raw` e um `userId` puro (nao base64 de claims), so para o seed da
  // demonstracao em desenvolvimento. Em producao nao vale: o cookie sem
  // assinatura seria uma sessao forjada.
  if (process.env.NODE_ENV === "production") return null;
  const user = store.users.find((u) => u.id === raw);
  if (!user) return null;

  const professional = user.professionalId
    ? store.professionals.find((p) => p.id === user.professionalId)
    : undefined;

  return {
    ...user,
    professional: professional
      ? { id: professional.id, name: professional.name, status: professional.status }
      : undefined,
  };
}

/**
 * A conta entra so pelo Google (sem senha)? Le os provedores da sessao do
 * Supabase no proprio cookie, sem ida ao servidor de autenticacao: serve so
 * para a tela (esconder Seguranca no menu da conta, 04/11/2026). As acoes de
 * verificacao conferem de novo no servidor.
 */
export async function getSessionGoogleOnly(user: Pick<UserView, "organizationId">): Promise<boolean> {
  if (!isSupabaseOrganization(user.organizationId)) return false;
  try {
    const supabase = await createSupabaseServerClient();
    // Os provedores vem no proprio token (claim app_metadata); ler `session.user`
    // no server faria o Supabase avisar no log a cada tela.
    const claims = await readSessionClaims(supabase);
    const providers = claims?.app_metadata?.providers;
    return Array.isArray(providers) && isGoogleOnlyAccount(providers.map(String));
  } catch {
    return false;
  }
}

/**
 * A sessao do banco (Supabase) ainda vale? O cookie do app dura 7 dias e a casca
 * abre so com ele; sem a sessao do banco toda leitura volta "Sua sessão
 * expirou" (25/11/2026). Le o cookie ja renovado pelo `proxy.ts`, sem ida ao
 * Auth. Falha passageira do Auth conta como viva (a acao confere de novo).
 */
export async function hasDatabaseSession(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getSession();
    if (error && (isAuthRetryableFetchError(error) || (isAuthApiError(error) && (error.status === 429 || error.status >= 500)))) {
      return true;
    }
    return Boolean(data.session?.access_token);
  } catch {
    return true;
  }
}

/**
 * Fuso do espaco da sessao (achado 60): o navegador usa o do espaco, nao o do
 * aparelho. Sai da mesma leitura que confere o usuario (uma consulta por tela).
 */
export async function getSessionTimeZone(user: Pick<UserView, "id" | "organizationId">): Promise<SpaceTimeZone> {
  if (!isSupabaseOrganization(user.organizationId)) return DEFAULT_SPACE_TIME_ZONE;
  return (await loadSessionSpace(user.id, user.organizationId)).timeZone;
}

/**
 * Plano do espaco da sessao, lido do banco (achado 80): na conta real a tela
 * paga nao confia no cookie espelho, que o navegador pede para gravar.
 * `undefined` fora do banco (demonstracao) ou sem leitura.
 */
export async function getSessionTier(user: Pick<UserView, "id" | "organizationId">): Promise<SubscriptionTier | undefined> {
  if (!isSupabaseOrganization(user.organizationId)) return undefined;
  return (await loadSessionSpace(user.id, user.organizationId)).tier;
}

interface SessionSpace {
  active: boolean;
  profile?: UserProfile;
  timeZone: SpaceTimeZone;
  tier?: SubscriptionTier;
}

// Uma leitura por requisicao, para o usuario e o fuso.
const loadSessionSpace = cache(async (userId: string, organizationId: string): Promise<SessionSpace> => {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("users")
      .select("status, profile, organizations(status, settings, subscription, units(address))")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const organization = (data?.organizations ?? null) as {
      status?: string;
      settings?: { timeZone?: string } | null;
      subscription?: { tier?: SubscriptionTier } | null;
      units?: { address?: { state?: string } | string | null }[];
    } | null;
    return {
      // Espaco inativado pelo painel (LGPD/encerramento): ninguem entra nem segue logado.
      active: data?.status === "active" && organization?.status === "active",
      profile: (data?.profile as UserProfile | undefined) ?? undefined,
      timeZone: resolveSpaceTimeZone(organization?.settings, organization?.units?.[0]?.address),
      tier: data ? (organization?.subscription?.tier ?? "free") : undefined,
    };
  } catch {
    // Sem banco (ambiente sem Supabase): nao derruba a sessao por isso.
    return { active: true, timeZone: DEFAULT_SPACE_TIME_ZONE };
  }
});
