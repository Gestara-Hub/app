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
import type { PlanChangePaymentCheck, PlanChangePreview, PlanChangeStart } from "../server/subscriptionPlan";
import type { SubscriptionEventView } from "../server/subscriptionEvents";
import {
  cancelScheduledPlanChangeAction,
  changePlanAction,
  listPlanHistoryAction,
  checkPlanChangePaymentAction,
  previewPlanChangeAction,
  simulatePlanChangePaymentAction,
  type PlanTarget,
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
 * `subscription:manage` (so owner). Ver docs/technical/24. Na conta
 * real quem grava o plano e o servidor (subscriptionActions e o checkout); aqui
 * o store so reflete o que ele devolveu.
 */

function currentSubscription(): Subscription {
  const sub = store.organization.subscription;
  return {
    tier: tierOf(store.organization),
    interval: sub?.interval,
    status: sub?.status,
    renewsOn: sub?.renewsOn,
    scheduledChange: sub?.scheduledChange,
    pendingChange: sub?.pendingChange,
    pendingPayment: sub?.pendingPayment,
    revertedFrom: sub?.revertedFrom,
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
      // Conta real: o servidor grava o historico do plano e a Auditoria.
      if (realAccountInBrowser()) return currentSubscription();

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

  /** Conta da troca de plano (doc product/13 §6), sem cobrar nada. */
  previewPlanChange(target: PlanTarget): Promise<PlanChangePreview> {
    return readOp(async () => {
      assertRealAccount();
      return unwrap(previewPlanChangeAction(target));
    });
  },

  /** Troca o plano: marca a reducao ou gera a cobranca da diferenca do upgrade. */
  changePlan(target: PlanTarget): Promise<PlanChangeStart> {
    return writeOp(async () => {
      assertRealAccount();
      // O servidor grava o historico do plano e a Auditoria (doc technical/23).
      const start = await unwrap(changePlanAction(target));
      store.organization = { ...store.organization, subscription: start.subscription };
      return start;
    });
  },

  /** Confere o pagamento da diferenca; pago, o servidor ja ligou o plano. */
  checkPlanChangePayment(paymentId: string): Promise<PlanChangePaymentCheck> {
    return writeOp(async () => {
      const check = await unwrap(checkPlanChangePaymentAction(paymentId));
      if (check.isPaid && check.subscription) {
        store.organization = { ...store.organization, subscription: check.subscription };
      }
      return check;
    });
  },

  simulatePlanChangePayment(paymentId: string): Promise<PlanChangePaymentCheck> {
    return writeOp(async () => {
      const check = await unwrap(simulatePlanChangePaymentAction(paymentId));
      if (check.isPaid && check.subscription) {
        store.organization = { ...store.organization, subscription: check.subscription };
      }
      return check;
    });
  },

  /** Historico do plano (so na conta real; o espaco so do navegador nao tem). */
  listHistory(): Promise<SubscriptionEventView[]> {
    return readOp(async () => (realAccountInBrowser() ? unwrap(listPlanHistoryAction()) : []));
  },

  /** Desmarca a troca marcada para o fim do periodo. */
  cancelScheduledChange(): Promise<Subscription> {
    return writeOp(async () => {
      assertRealAccount();
      const subscription = await unwrap(cancelScheduledPlanChangeAction());
      store.organization = { ...store.organization, subscription };
      return currentSubscription();
    });
  },

  /**
   * Plano pago ja gravado pelo servidor: reflete no store. O historico e a
   * Auditoria saem do servidor; no espaco so do navegador, a Auditoria daqui.
   */
  activatePaidSubscription(subscription: Subscription): Promise<Subscription> {
    return writeOp(async () => {
      const before = tierOf(store.organization);
      store.organization = { ...store.organization, subscription };
      const tier = subscription.tier;
      if (realAccountInBrowser()) return currentSubscription();

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

/** A troca de plano roda no servidor (Asaas e banco); sem conta real, nao ha o que trocar. */
function assertRealAccount(): void {
  if (!realAccountInBrowser()) {
    throw apiError("CONFLICT", "A troca de plano está disponível na conta real.", { httpStatus: 409 });
  }
}
