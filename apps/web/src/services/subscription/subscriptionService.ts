import type {
  ApiError,
  PaidFeature,
  Subscription,
  SubscriptionInterval,
  SubscriptionTier,
} from "@gestarahub/contracts";
import { hasFeature, isSubscriptionTier, tierOf } from "@/lib/subscription";
import { paidFeatureLabel, subscriptionTierLabel } from "@/lib/labels";
import { apiError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { realAccountInBrowser } from "../world/delegate";
import { unwrap } from "../server/action";
import { auditLogService } from "../audit/auditLogService";
import {
  checkAsaasSubscriptionPaymentAction,
  createAsaasSubscriptionCheckoutAction,
  simulateAsaasSubscriptionPaymentAction,
  updateOrganizationSubscriptionAction,
  type CreateSubscriptionInput,
  type SubscriptionCheckoutResult,
} from "./actions";

/**
 * Plano GestaraHub (assinatura) do tenant ativo. Na demonstracao o proprietario
 * troca o tier nas Configuracoes (aba "Plano GestaraHub"); o gating da tela e
 * `subscription:manage` (so owner). Ver docs/technical/05 (secao 3). Na conta
 * real quem grava o plano e o servidor (subscriptionActions e o checkout); aqui
 * o store so reflete o que ele devolveu.
 */

function currentSubscription(): Subscription {
  const sub = store.organization.subscription;
  return {
    tier: tierOf(store.organization),
    interval: sub?.interval,
    status: sub?.status,
    asaasCustomerId: sub?.asaasCustomerId,
    asaasSubscriptionId: sub?.asaasSubscriptionId,
    nextDueDate: sub?.nextDueDate,
    priceCents: sub?.priceCents,
    paymentMethod: sub?.paymentMethod,
    changedAt: sub?.changedAt,
  };
}

/** Erro padrao do recurso fora do plano (403). */
export function featureNotInPlanError(feature: PaidFeature): ApiError {
  return apiError(
    "FEATURE_NOT_IN_PLAN",
    `${paidFeatureLabel(feature)} está disponível no Plano Profissional.`,
    { httpStatus: 403 },
  );
}

/**
 * Guard dos services pagos: recusa com FEATURE_NOT_IN_PLAN quando o tier do
 * tenant ativo nao tem o recurso (defesa no "servidor", como no backend real).
 * Chamar no inicio do `writeOp` (e das leituras pagas, se preciso).
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
    return readOp(() => currentSubscription());
  },

  setTier(tier: SubscriptionTier): Promise<Subscription> {
    return writeOp(async () => {
      if (!isSubscriptionTier(tier)) {
        throw validationError([{ field: "tier", message: "Plano inválido." }]);
      }
      const before = tierOf(store.organization);
      if (before === tier) return currentSubscription();

      // Conta real: o servidor confere a regra (pago so na demonstracao) e
      // cancela a assinatura no Asaas ao voltar ao Gratis.
      const subscription = realAccountInBrowser()
        ? await unwrap(updateOrganizationSubscriptionAction(store.organization.id, tier))
        : { tier, changedAt: nowIso(), status: tier === "free" ? undefined : ("active" as const) };
      store.organization = { ...store.organization, subscription };

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

  createCheckoutSession(
    input: Omit<CreateSubscriptionInput, "organizationId">,
  ): Promise<SubscriptionCheckoutResult> {
    return writeOp(async () => {
      const orgId = store.organization.id;
      const res = await createAsaasSubscriptionCheckoutAction({
        ...input,
        organizationId: orgId,
      });

      if (res.success && res.subscription) await this.activatePaidSubscription(res.subscription);

      return res;
    });
  },

  checkPaymentStatus(paymentId: string): Promise<{ status: string; isPaid: boolean }> {
    return writeOp(async () => {
      const res = await checkAsaasSubscriptionPaymentAction(paymentId);
      if (res.isPaid && res.subscription && tierOf(store.organization) !== res.subscription.tier) {
        await this.activatePaidSubscription(res.subscription);
      }
      return { status: res.status, isPaid: res.isPaid };
    });
  },

  simulatePayment(
    paymentId: string,
    tier: "pro" | "scale",
    interval: SubscriptionInterval,
    subscriptionId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return writeOp(async () => {
      const res = await simulateAsaasSubscriptionPaymentAction(paymentId, tier, interval, subscriptionId);
      if (res.success && res.subscription) await this.activatePaidSubscription(res.subscription);
      return { success: res.success, error: res.error };
    });
  },

  /** Plano pago ja gravado pelo servidor: reflete no store e registra na auditoria. */
  activatePaidSubscription(subscription: Subscription): Promise<Subscription> {
    return writeOp(async () => {
      const before = tierOf(store.organization);
      store.organization = { ...store.organization, subscription };
      const tier = subscription.tier;

      auditLogService.record({
        action: "updated",
        target: { type: "subscription", label: "Plano GestaraHub" },
        predicate: `ativou o Plano ${subscriptionTierLabel(tier)} (${subscription.interval === "yearly" ? "Anual" : "Mensal"}) via ${subscription.paymentMethod === "credit_card" ? "Cartão de Crédito" : "Pix"}`,
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

