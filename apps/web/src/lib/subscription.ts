import type {
  Organization,
  PaidFeature,
  SubscriptionTier,
} from "@gestarahub/contracts";

/**
 * Matriz tier -> recursos pagos (fonte unica do gating por plano; espelha
 * lib/permissions). Uma tela paga exige as duas coisas: a permissao do perfil
 * (`can`) E o recurso do plano (`hasFeature`). Ver docs/technical/05 (secao 3).
 */
export const TIER_FEATURES: Record<SubscriptionTier, readonly PaidFeature[]> = {
  free: [],
  pro: ["online_payments", "messaging", "reports_advanced"],
  scale: ["online_payments", "messaging", "reports_advanced", "bi"],
};

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = ["free", "pro", "scale"];

/** Tier efetivo da organizacao (sem assinatura = free). */
export function tierOf(org: Pick<Organization, "subscription"> | null | undefined): SubscriptionTier {
  return org?.subscription?.tier ?? "free";
}

/** O tier inclui o recurso? */
export function tierHasFeature(tier: SubscriptionTier, feature: PaidFeature): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

/** A organizacao tem o recurso no plano? */
export function hasFeature(
  org: Pick<Organization, "subscription"> | null | undefined,
  feature: PaidFeature,
): boolean {
  return tierHasFeature(tierOf(org), feature);
}

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === "free" || value === "pro" || value === "scale";
}

/**
 * Cookie espelho do tier para o SERVER (mock). O tier vive no store do
 * navegador (localStorage); o server so enxerga o seed. O client grava
 * "<organizationId>:<tier>" via server action ao trocar o plano (e ao detectar
 * divergencia), e as pages pagas leem daqui. Na fase de backend o tier vem da
 * organizacao no banco e este cookie some.
 */
export const SUBSCRIPTION_COOKIE = "gestarahub_tier";

export function encodeTierCookie(organizationId: string, tier: SubscriptionTier): string {
  return `${organizationId}:${tier}`;
}

/** Le o tier do cookie so se for da organizacao pedida. */
export function decodeTierCookie(
  raw: string | undefined,
  organizationId: string,
): SubscriptionTier | undefined {
  if (!raw) return undefined;
  const idx = raw.lastIndexOf(":");
  if (idx <= 0) return undefined;
  const org = raw.slice(0, idx);
  const tier = raw.slice(idx + 1);
  return org === organizationId && isSubscriptionTier(tier) ? tier : undefined;
}
