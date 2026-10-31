import { platformSplitCents, type PlatformTier } from "@gestarahub/core/payment-fees";

/**
 * Taxa do GestaraHub que o parceiro retem de fato (decisao 4 da noite de
 * 31/10/2026, confirmada pelo usuario). Com o Asaas ligado e sem a carteira
 * principal (`ASAAS_MASTER_WALLET_ID`), nao ha split: a taxa nao e somada ao
 * valor do aluno nem descontada do liquido do espaco. Sem o Asaas (demonstracao
 * no navegador e e2e), o provedor de demonstracao simula o split.
 */
export function effectivePlatformSplitCents(tier: PlatformTier | undefined): number {
  const splitActive = !process.env.ASAAS_API_KEY || Boolean(process.env.ASAAS_MASTER_WALLET_ID);
  return splitActive ? platformSplitCents(tier) : 0;
}
