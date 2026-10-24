import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_SPACE_TIME_ZONE, resolveSpaceTimeZone, type SpaceTimeZone } from "@gestarahub/core/date";
import { SESSION_COOKIE, decodeSession, isSupabaseOrganization } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { store } from "@/mocks/store";
import type { UserView } from "@gestarahub/contracts";

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
    // Conta real: o usuario ainda existe e esta ativo no espaco? Inativado ou
    // removido, a sessao acaba (antes seguia navegando so com o cookie).
    if (isSupabaseOrganization(claims.organizationId) && !(await loadSessionSpace(claims.id, claims.organizationId)).active) {
      return null;
    }
    return claims;
  }

  // Legado: `raw` e um `userId` puro (nao base64 de claims).
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
 * Fuso do espaco da sessao (achado 60): o navegador usa o do espaco, nao o do
 * aparelho. Sai da mesma leitura que confere o usuario (uma consulta por tela).
 */
export async function getSessionTimeZone(user: Pick<UserView, "id" | "organizationId">): Promise<SpaceTimeZone> {
  if (!isSupabaseOrganization(user.organizationId)) return DEFAULT_SPACE_TIME_ZONE;
  return (await loadSessionSpace(user.id, user.organizationId)).timeZone;
}

interface SessionSpace {
  active: boolean;
  timeZone: SpaceTimeZone;
}

// Uma leitura por requisicao, para o usuario e o fuso.
const loadSessionSpace = cache(async (userId: string, organizationId: string): Promise<SessionSpace> => {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("users")
      .select("status, organizations(settings, units(address))")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const organization = (data?.organizations ?? null) as {
      settings?: { timeZone?: string } | null;
      units?: { address?: { state?: string } | string | null }[];
    } | null;
    return {
      active: data?.status === "active",
      timeZone: resolveSpaceTimeZone(organization?.settings, organization?.units?.[0]?.address),
    };
  } catch {
    // Sem banco (ambiente sem Supabase): nao derruba a sessao por isso.
    return { active: true, timeZone: DEFAULT_SPACE_TIME_ZONE };
  }
});
