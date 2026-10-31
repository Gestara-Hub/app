import type { SupabaseClient } from "@supabase/supabase-js";
import { tierWhatsAppQuota, type Subscription, type SubscriptionTier } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { annualQuotaCycleStart } from "@gestarahub/core/subscription-plan";
import { logWarn } from "@/lib/log";

/**
 * Franquia de mensagens automaticas do WhatsApp (doc product/13 §5): zera e
 * passa a ser a do plano quando o pagamento do plano e confirmado (ativacao,
 * renovacao, religar, troca aplicada). No plano anual, renova tambem todo mes,
 * no dia do ciclo (`renewAnnualQuotaIfDue`, rotina diaria). Falha ao gravar
 * nao desfaz o pagamento: fica no registro de erros. Modulo so do servidor.
 */
export async function resetWhatsAppQuota(
  admin: SupabaseClient,
  organizationId: string,
  tier: SubscriptionTier,
  cycleStart: string = dateInSpace(),
): Promise<void> {
  const { error } = await admin
    .from("whatsapp_connections")
    .update({ monthly_quota: { used: 0, included: tierWhatsAppQuota(tier), cycleStart } })
    .eq("organization_id", organizationId);
  if (error) logWarn("[whatsappQuota] Franquia do WhatsApp não zerada:", { organizationId, tier, error: error.message });
}

/**
 * Plano anual: o mes da franquia virou desde o ultimo ciclo guardado? Zera e
 * guarda o novo ciclo (decisao do usuario de 30/10/2026). Devolve se renovou.
 */
export async function renewAnnualQuotaIfDue(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
  today: string,
): Promise<boolean> {
  if (subscription.tier === "free" || subscription.interval !== "yearly" || !subscription.renewsOn) return false;
  const cycleStart = annualQuotaCycleStart(subscription.renewsOn, today);
  if (!cycleStart) return false;
  const { data, error } = await admin
    .from("whatsapp_connections")
    .select("monthly_quota")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    logWarn("[whatsappQuota] Franquia do WhatsApp não lida:", { organizationId, error: error.message });
    return false;
  }
  // Sem conexao gravada ainda: nada a renovar (ela nasce com a franquia do plano).
  if (!data) return false;
  const stored = (data.monthly_quota as { cycleStart?: string } | null)?.cycleStart;
  if (stored && stored >= cycleStart) return false;
  await resetWhatsAppQuota(admin, organizationId, subscription.tier, cycleStart);
  return true;
}
