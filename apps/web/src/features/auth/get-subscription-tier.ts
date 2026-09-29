import { cookies } from "next/headers";
import { SUBSCRIPTION_COOKIE, decodeTierCookie, tierHasFeature } from "@/lib/subscription";
import { organizationTierById } from "@/mocks/store";
import type { Id, PaidFeature, SubscriptionTier, UserView } from "@gestarahub/contracts";

/**
 * Tier do plano GestaraHub da organizacao, no SERVER. Server-only (usa
 * `next/headers`). O tier vive no store do navegador; o client espelha no
 * cookie `gestarahub_tier` (SessionProvider). Sem cookie da mesma org, cai no
 * seed (free). Na fase de backend, vem da organizacao no banco.
 */
export async function getOrganizationTier(organizationId: Id): Promise<SubscriptionTier> {
  const raw = (await cookies()).get(SUBSCRIPTION_COOKIE)?.value;
  return decodeTierCookie(raw, organizationId) ?? organizationTierById(organizationId) ?? "free";
}

/**
 * O tenant do usuario tem o recurso pago? Para as pages pagas decidirem entre a
 * tela e o upsell (FeatureLocked), depois do `requirePermission`.
 */
export async function sessionHasFeature(
  user: Pick<UserView, "organizationId">,
  feature: PaidFeature,
): Promise<boolean> {
  return tierHasFeature(await getOrganizationTier(user.organizationId), feature);
}
