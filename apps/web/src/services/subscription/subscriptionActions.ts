"use server";

import type { Subscription, SubscriptionTier } from "@gestarahub/contracts";
import { forbiddenError, validationError } from "@gestarahub/core/api-error";
import { AsaasApiError, cancelSubscription, getAsaasConfig } from "@/lib/asaas";
import { isDemoOrganization } from "@/lib/demo";
import { isSubscriptionTier } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAction, type ActionResult } from "../server/action";
import { dateInSpace } from "@gestarahub/core/date";
import { readOrganizationSubscription, writeOrganizationSubscription } from "../server/subscription";
import { currentPlanOf, startPlanChange } from "../server/subscriptionPlan";
import { requireSameOrganization } from "../server/tenant";

/**
 * Troca direta do plano nas Configuracoes: voltar ao Gratis em qualquer
 * espaco (conta real com dias pagos: marcado para o fim do periodo); o plano
 * pago so no espaco de demonstracao. Na conta real o plano
 * pago vem do pagamento conferido no servidor (subscriptionCheckoutActions).
 */
export async function updateOrganizationSubscriptionAction(
  organizationId: string,
  tier: SubscriptionTier,
): Promise<ActionResult<Subscription>> {
  return runAction(async () => {
    await requireSameOrganization(organizationId, { permissions: ["subscription:manage"] });
    if (!isSubscriptionTier(tier)) throw validationError([{ field: "tier", message: "Plano inválido." }]);
    if (tier !== "free" && !isDemoOrganization(organizationId)) {
      throw forbiddenError("O Plano Profissional é ativado pelo pagamento, em Planos.");
    }

    const admin = createSupabaseAdminClient();
    const current = await readOrganizationSubscription(admin, organizationId);
    // Conta real com dias pagos: o Gratis vale no fim do periodo (doc product/13 §6).
    const renewsOn = currentPlanOf(current).renewsOn;
    if (tier === "free" && current && current.tier !== "free" && !isDemoOrganization(organizationId) && renewsOn && renewsOn > dateInSpace()) {
      const start = await startPlanChange(admin, organizationId, { tier: "free", interval: current.interval ?? "monthly" });
      return start.subscription;
    }
    if (tier === "free") await cancelAsaasSubscription(current?.asaasSubscriptionId);

    const changedAt = new Date().toISOString();
    const subscription: Subscription = tier === "free" ? { tier, changedAt } : { tier, status: "active", changedAt };
    await writeOrganizationSubscription(admin, organizationId, subscription);
    return subscription;
  }, "updateOrganizationSubscriptionAction");
}

/**
 * Cancela a assinatura no Asaas ao voltar ao Gratis. Falha impede a troca (o
 * espaco seguiria sendo cobrado); assinatura ja removida no Asaas conta como feita.
 */
async function cancelAsaasSubscription(subscriptionId: string | undefined): Promise<void> {
  if (!subscriptionId || subscriptionId.startsWith("sub_mock_") || !getAsaasConfig().masterApiKey) return;
  try {
    await cancelSubscription(subscriptionId);
  } catch (error) {
    if (error instanceof AsaasApiError && error.status === 404) return;
    throw error;
  }
}
