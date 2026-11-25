import type { SubscriptionTier } from "@gestarahub/contracts";
import { subscriptionTierLabel } from "@/lib/labels";
import { openSupport } from "@/features/support";

/**
 * Direito de arrependimento (Termos, 7 dias do pagamento; doc technical/24
 * §7.1): abre o suporte com o pedido ja escrito, direto para a equipe. A
 * equipe estorna no Asaas e o webhook volta o espaco ao Gratis e cancela a nota.
 */
export function requestPlanRefund(tier: SubscriptionTier): void {
  openSupport({
    direct: true,
    draft: `Quero cancelar o Plano ${subscriptionTierLabel(tier)} e receber o valor de volta (até 7 dias do pagamento).`,
  });
}
