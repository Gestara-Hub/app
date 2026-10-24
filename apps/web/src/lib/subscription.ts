import type {
  Organization,
  PaidFeature,
  SubscriptionInterval,
  SubscriptionTier,
} from "@gestarahub/contracts";

/**
 * Matriz tier -> recursos pagos (fonte unica do gating por plano; espelha
 * lib/permissions). Uma tela paga exige as duas coisas: a permissao do perfil
 * (`can`) E o recurso do plano (`hasFeature`). Ver docs/technical/05 (secao 3).
 */
export const TIER_FEATURES: Record<SubscriptionTier, readonly PaidFeature[]> = {
  free: ["online_payments"],
  pro: ["online_payments", "messaging", "reports_advanced", "certificates"],
  scale: ["online_payments", "messaging", "reports_advanced", "certificates", "bi"],
};

/** O que o Profissional tem a mais que o Grátis (a lista da aba "Plano GestaraHub"). */
export function proOnlyFeatures(): PaidFeature[] {
  return TIER_FEATURES.pro.filter((feature) => !TIER_FEATURES.free.includes(feature));
}

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

export type PaidTier = Exclude<SubscriptionTier, "free">;

/**
 * Referencia da assinatura no Asaas ("<organizationId>:<tier>:<interval>"):
 * ao conferir o pagamento, o servidor sabe o espaco e o plano pelo Asaas, sem
 * confiar no que o navegador manda (achado 66 do teste de 23/10).
 */
export function encodeSubscriptionReference(
  organizationId: string,
  tier: PaidTier,
  interval: SubscriptionInterval,
): string {
  return `${organizationId}:${tier}:${interval}`;
}

export function decodeSubscriptionReference(
  raw: string | null | undefined,
): { organizationId: string; tier: PaidTier; interval: SubscriptionInterval } | undefined {
  const [organizationId, tier, interval, ...rest] = (raw ?? "").split(":");
  if (!organizationId || rest.length > 0) return undefined;
  if (tier !== "pro" && tier !== "scale") return undefined;
  if (interval !== "monthly" && interval !== "yearly") return undefined;
  return { organizationId, tier, interval };
}

const PLAN_CHANGE_PREFIX = "plan-change";

/**
 * Referencia da cobranca avulsa da diferenca de um upgrade
 * ("plan-change:<organizationId>:<tier>:<interval>"): o pagamento confirmado
 * no Asaas diz ao servidor qual troca ligar (doc product/13 §6).
 */
export function encodePlanChangeReference(
  organizationId: string,
  tier: PaidTier,
  interval: SubscriptionInterval,
): string {
  return `${PLAN_CHANGE_PREFIX}:${encodeSubscriptionReference(organizationId, tier, interval)}`;
}

export function decodePlanChangeReference(
  raw: string | null | undefined,
): ReturnType<typeof decodeSubscriptionReference> {
  const value = raw ?? "";
  if (!value.startsWith(`${PLAN_CHANGE_PREFIX}:`)) return undefined;
  return decodeSubscriptionReference(value.slice(PLAN_CHANGE_PREFIX.length + 1));
}
