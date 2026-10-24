import type { SubscriptionInterval, SubscriptionTier } from "@gestarahub/contracts";

/**
 * Precos do Plano GestaraHub (aprovados em 19/10/2026, doc product/13): fonte
 * unica para o app dos clientes (cobranca) e o painel admin (catalogo).
 */
export interface SubscriptionPriceConfig {
  value: number;
  priceCents: number;
  label: string;
  description: string;
}

export const SUBSCRIPTION_PRICES: Record<
  Extract<SubscriptionTier, "pro" | "scale">,
  Record<SubscriptionInterval, SubscriptionPriceConfig>
> = {
  pro: {
    monthly: {
      value: 79.9,
      priceCents: 7990,
      label: "R$ 79,90/mês",
      description: "Plano Profissional - GestaraHub (Mensal)",
    },
    yearly: {
      value: 799.0,
      priceCents: 79900,
      label: "R$ 799,00/ano",
      description: "Plano Profissional - GestaraHub (Anual)",
    },
  },
  scale: {
    monthly: {
      value: 199.0,
      priceCents: 19900,
      label: "R$ 199,00/mês",
      description: "Plano Expansão - GestaraHub (Mensal)",
    },
    yearly: {
      value: 1990.0,
      priceCents: 199000,
      label: "R$ 1.990,00/ano",
      description: "Plano Expansão - GestaraHub (Anual)",
    },
  },
};
