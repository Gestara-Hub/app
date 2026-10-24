import { cookies } from "next/headers";
import { SUBSCRIPTION_COOKIE, decodeTierCookie, tierHasFeature } from "@/lib/subscription";
import { organizationTierById } from "@/mocks/store";
import type { PaidFeature, SubscriptionTier, UserView } from "@gestarahub/contracts";
import { getSessionTier } from "./get-current-user";

/**
 * Tier do plano GestaraHub da organizacao, no SERVER. Server-only (usa
 * `next/headers`). Conta real: o plano do banco, gravado so pelo servidor
 * (achado 80). Demonstracao: o tier vive no store do navegador, espelhado no
 * cookie `gestarahub_tier` (SessionProvider); sem cookie, o seed (free).
 */
export async function getOrganizationTier(user: Pick<UserView, "id" | "organizationId">): Promise<SubscriptionTier> {
  const fromDb = await getSessionTier(user);
  if (fromDb) return fromDb;
  const raw = (await cookies()).get(SUBSCRIPTION_COOKIE)?.value;
  return decodeTierCookie(raw, user.organizationId) ?? organizationTierById(user.organizationId) ?? "free";
}

/**
 * O tenant do usuario tem o recurso pago? Para as pages pagas decidirem entre a
 * tela e o upsell (FeatureLocked), depois do `requirePermission`.
 */
export async function sessionHasFeature(
  user: Pick<UserView, "id" | "organizationId">,
  feature: PaidFeature,
): Promise<boolean> {
  return tierHasFeature(await getOrganizationTier(user), feature);
}
