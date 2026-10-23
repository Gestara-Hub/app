"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Subscription, SubscriptionTier } from "@gestarahub/contracts";
import { cancelSubscription, getAsaasConfig } from "@/lib/asaas";
import { requireSameOrganization } from "../server/tenant";
import { logError } from "@/lib/log";

/**
 * Plano do espaco no banco: trocar e cancelar a assinatura.
 */

/**
 * Atualiza o plano de assinatura da organização no Supabase.
 * Suporta tanto o objeto Subscription completo quanto apenas o tier (retrocompatibilidade).
 */
export async function updateOrganizationSubscriptionAction(
  organizationId: string,
  subscriptionOrTier: SubscriptionTier | Subscription,
): Promise<boolean> {
  await requireSameOrganization(organizationId, { permissions: ["subscription:manage"] });
  try {
    const adminClient = createSupabaseAdminClient();
    const payload =
      typeof subscriptionOrTier === "string"
        ? {
            tier: subscriptionOrTier,
            changedAt: new Date().toISOString(),
          }
        : {
            ...subscriptionOrTier,
            changedAt: subscriptionOrTier.changedAt || new Date().toISOString(),
          };

    const { error } = await adminClient
      .from("organizations")
      .update({
        subscription: payload,
      })
      .eq("id", organizationId);

    if (error) {
      logError("[updateOrganizationSubscriptionAction] Erro no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    logError("[updateOrganizationSubscriptionAction] Exceção:", err);
    return false;
  }
}

/**
 * Cancela a assinatura atual no Asaas caso exista.
 */
export async function cancelAsaasSubscriptionAction(
  subscriptionId: string,
): Promise<boolean> {
  const config = getAsaasConfig();
  if (!config.masterApiKey || subscriptionId.startsWith("sub_mock_")) {
    return true;
  }

  try {
    await cancelSubscription(subscriptionId);
    return true;
  } catch (err) {
    logError("[cancelAsaasSubscriptionAction] Erro ao cancelar:", err);
    return false;
  }
}
