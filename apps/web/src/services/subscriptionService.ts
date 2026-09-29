import type { ApiError, PaidFeature, Subscription, SubscriptionTier } from "@gestarahub/contracts";
import { hasFeature, isSubscriptionTier, tierOf } from "@/lib/subscription";
import { paidFeatureLabel, subscriptionTierLabel } from "@/lib/labels";
import { apiError, nowIso, simulateRead, simulateWrite, validationError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";

/**
 * Plano GestaraHub (assinatura) do tenant ativo. Na demonstracao o proprietario
 * troca o tier nas Configuracoes (aba "Plano GestaraHub"); o gating da tela e
 * `subscription:manage` (so owner). Ver docs/technical/05 (secao 3).
 */

function currentSubscription(): Subscription {
  const changedAt = store.organization.subscription?.changedAt;
  return { tier: tierOf(store.organization), ...(changedAt ? { changedAt } : {}) };
}

/** Erro padrao do recurso fora do plano (403). */
export function featureNotInPlanError(feature: PaidFeature): ApiError {
  return apiError(
    "FEATURE_NOT_IN_PLAN",
    `${paidFeatureLabel(feature)} está disponível no Plano Pro.`,
    { httpStatus: 403 },
  );
}

/**
 * Guard dos services pagos: recusa com FEATURE_NOT_IN_PLAN quando o tier do
 * tenant ativo nao tem o recurso (defesa no "servidor", como no backend real).
 * Chamar no inicio do `simulateWrite` (e das leituras pagas, se preciso).
 */
export function assertFeature(feature: PaidFeature): void {
  if (!hasFeature(store.organization, feature)) throw featureNotInPlanError(feature);
}

/** Versao booleana para os services decidirem sem lancar. */
export function tenantHasFeature(feature: PaidFeature): boolean {
  return hasFeature(store.organization, feature);
}

export const subscriptionService = {
  get(): Promise<Subscription> {
    return simulateRead(() => currentSubscription());
  },

  setTier(tier: SubscriptionTier): Promise<Subscription> {
    return simulateWrite(() => {
      if (!isSubscriptionTier(tier)) {
        throw validationError([{ field: "tier", message: "Plano inválido." }]);
      }
      const before = tierOf(store.organization);
      if (before === tier) return currentSubscription();
      store.organization = {
        ...store.organization,
        subscription: { tier, changedAt: nowIso() },
      };
      auditLogService.record({
        action: "updated",
        target: { type: "subscription", label: "Plano GestaraHub" },
        predicate: `trocou o Plano GestaraHub de ${subscriptionTierLabel(before)} para ${subscriptionTierLabel(tier)}`,
        changes: [
          {
            field: "tier",
            label: "Plano",
            before: subscriptionTierLabel(before),
            after: subscriptionTierLabel(tier),
          },
        ],
        security: true,
      });
      return currentSubscription();
    });
  },
};
