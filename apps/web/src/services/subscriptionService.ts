import type {
  ApiError,
  PaidFeature,
  Subscription,
  SubscriptionInterval,
  SubscriptionTier,
} from "@gestarahub/contracts";
import { hasFeature, isSubscriptionTier, tierOf } from "@/lib/subscription";
import { paidFeatureLabel, subscriptionTierLabel } from "@/lib/labels";
import { apiError, nowIso, simulateRead, simulateWrite, validationError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { isSupabaseOrganization } from "@/lib/session";
import { auditLogService } from "./auditLogService";
import {
  cancelAsaasSubscriptionAction,
  checkAsaasSubscriptionPaymentAction,
  createAsaasSubscriptionCheckoutAction,
  simulateAsaasSubscriptionPaymentAction,
  updateOrganizationSubscriptionAction,
  type CreateSubscriptionInput,
  type SubscriptionCheckoutResult,
} from "./subscriptionBackend";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";

/**
 * Plano GestaraHub (assinatura) do tenant ativo. Na demonstracao o proprietario
 * troca o tier nas Configuracoes (aba "Plano GestaraHub"); o gating da tela e
 * `subscription:manage` (so owner). Ver docs/technical/05 (secao 3).
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
    return simulateWrite(async () => {
      if (!isSubscriptionTier(tier)) {
        throw validationError([{ field: "tier", message: "Plano inválido." }]);
      }
      const before = tierOf(store.organization);
      if (before === tier) return currentSubscription();

      // Se estiver voltando para o free, cancela assinatura ativa no Asaas se houver
      if (tier === "free" && store.organization.subscription?.asaasSubscriptionId) {
        try {
          await cancelAsaasSubscriptionAction(
            store.organization.subscription.asaasSubscriptionId,
          );
        } catch (err) {
          console.warn("[subscriptionService] Erro ao cancelar assinatura no Asaas:", err);
        }
      }

      store.organization = {
        ...store.organization,
        subscription: {
          tier,
          changedAt: nowIso(),
          status: tier === "free" ? undefined : "active",
        },
      };

      if (isSupabaseOrganization(store.organization.id)) {
        try {
          await updateOrganizationSubscriptionAction(store.organization.id, tier);
        } catch (dbErr) {
          console.error(
            "[subscriptionService] Erro ao sincronizar tier com Supabase:",
            dbErr,
          );
        }
      }

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
    return simulateWrite(async () => {
      const orgId = store.organization.id;
      const res = await createAsaasSubscriptionCheckoutAction({
        ...input,
        organizationId: orgId,
      });

      if (res.success && res.status === "active") {
        await this.activatePaidSubscription(input.tier, input.interval, {
          paymentMethod: input.billingType === "CREDIT_CARD" ? "credit_card" : "pix",
          asaasSubscriptionId: res.subscriptionId,
          asaasCustomerId: res.customerId,
        });
      }

      return res;
    });
  },

  checkPaymentStatus(paymentId: string): Promise<{ status: string; isPaid: boolean }> {
    return simulateRead(() => checkAsaasSubscriptionPaymentAction(paymentId));
  },

  simulatePayment(
    paymentId: string,
    tier: "pro" | "scale",
    interval: SubscriptionInterval,
    subscriptionId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return simulateWrite(async () => {
      const res = await simulateAsaasSubscriptionPaymentAction(
        paymentId,
        store.organization.id,
        tier,
        interval,
        subscriptionId,
      );
      if (res.success) {
        await this.activatePaidSubscription(tier, interval, {
          paymentMethod: "pix",
          asaasSubscriptionId: subscriptionId,
        });
      }
      return res;
    });
  },

  activatePaidSubscription(
    tier: "pro" | "scale",
    interval: SubscriptionInterval,
    meta?: {
      paymentMethod?: "pix" | "credit_card";
      asaasSubscriptionId?: string;
      asaasCustomerId?: string;
    },
  ): Promise<Subscription> {
    return simulateWrite(async () => {
      const before = tierOf(store.organization);
      const priceConfig = SUBSCRIPTION_PRICES[tier][interval];
      const newSub: Subscription = {
        tier,
        interval,
        status: "active",
        priceCents: priceConfig.priceCents,
        paymentMethod: meta?.paymentMethod,
        asaasSubscriptionId: meta?.asaasSubscriptionId,
        asaasCustomerId: meta?.asaasCustomerId,
        changedAt: nowIso(),
      };

      store.organization = {
        ...store.organization,
        subscription: newSub,
      };

      if (isSupabaseOrganization(store.organization.id)) {
        try {
          await updateOrganizationSubscriptionAction(store.organization.id, newSub);
        } catch (dbErr) {
          console.error(
            "[subscriptionService] Erro ao sincronizar tier com Supabase:",
            dbErr,
          );
        }
      }

      auditLogService.record({
        action: "updated",
        target: { type: "subscription", label: "Plano GestaraHub" },
        predicate: `ativou o Plano ${subscriptionTierLabel(tier)} (${interval === "yearly" ? "Anual" : "Mensal"}) via ${meta?.paymentMethod === "credit_card" ? "Cartão de Crédito" : "Pix"}`,
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

