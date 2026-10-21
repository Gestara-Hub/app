/**
 * Tarifas da cobranca online (doc 19, secao 4, decisao de 21/10/2026):
 * o espaco paga a tarifa do Asaas (sai da subconta dele) e mais a taxa do
 * GestaraHub (split fixo por cobranca, retido na liquidacao). Com o repasse
 * ligado, o aluno paga um valor maior que cobre as duas e o espaco recebe
 * exatamente o valor da cobranca.
 *
 * Tudo em centavos. Os percentuais sao fracoes (1,99% = 0.0199).
 */

export type OnlinePaymentMethodKind = "pix" | "link";
export type PlatformTier = "free" | "pro" | "scale";

/** Tarifa de um meio de pagamento: percentual sobre o valor mais um fixo. */
export interface GatewayFee {
  percent: number;
  fixedCents: number;
}

/**
 * Tabela de tarifas do Asaas na subconta (conta padrao, 21/10/2026).
 * `linkMethods` sao os meios que o aluno pode escolher na fatura do link.
 * O link e criado com `billingType: CREDIT_CARD`, e a fatura do Asaas oferece
 * credito e debito nesse modo; o pior caso e o credito. Parcelamento no link
 * ainda nao e oferecido. Pix tem a propria opcao na modal; boleto nao e oferecido.
 */
export interface GatewayFeeTable {
  pix: GatewayFee;
  boleto: GatewayFee;
  creditCard: GatewayFee;
  debitCard: GatewayFee;
  linkMethods: ReadonlyArray<"pix" | "boleto" | "creditCard" | "debitCard">;
}

export const ASAAS_FEES: GatewayFeeTable = {
  pix: { percent: 0, fixedCents: 199 },
  boleto: { percent: 0, fixedCents: 99 },
  creditCard: { percent: 0.0199, fixedCents: 49 },
  debitCard: { percent: 0.0189, fixedCents: 35 },
  linkMethods: ["creditCard", "debitCard"],
};

/** Taxa do GestaraHub por cobranca online recebida (doc 13). */
export const PLATFORM_SPLIT_CENTS: Record<PlatformTier, number> = {
  free: 199,
  pro: 129,
  scale: 129,
};

export function platformSplitCents(tier: PlatformTier | undefined): number {
  return PLATFORM_SPLIT_CENTS[tier ?? "free"];
}

/** Tarifa de um meio sobre um valor cobrado. */
export function gatewayFeeCents(fee: GatewayFee, chargedCents: number): number {
  if (chargedCents <= 0) return 0;
  return Math.round(chargedCents * fee.percent) + fee.fixedCents;
}

/**
 * Menor valor cobrado tal que `cobrado - tarifa(cobrado) - split = amount`.
 * Para tarifa so fixa vira soma; com percentual e o gross-up
 * `(amount + split + fixo) / (1 - percentual)`, ajustado para o arredondamento
 * nao deixar o liquido abaixo do valor.
 */
function grossUp(fee: GatewayFee, amountCents: number, splitCents: number): number {
  let charged = Math.ceil((amountCents + splitCents + fee.fixedCents) / (1 - fee.percent));
  while (charged - gatewayFeeCents(fee, charged) - splitCents < amountCents) charged += 1;
  return charged;
}

export interface OnlineChargeAmounts {
  /** O que o aluno paga. */
  chargedAmountCents: number;
  /** Tarifa do Asaas sobre o valor cobrado. */
  gatewayFeeCents: number;
  /** Taxa do GestaraHub. */
  splitAmountCents: number;
  /** Tarifa + taxa. */
  totalFeeCents: number;
  /** O que entra na subconta do espaco depois das duas. */
  netAmountCents: number;
  /**
   * No link o aluno escolhe credito ou debito, entao a tarifa so e conhecida
   * no pagamento: aqui vai a pior (credito), e `estimated` fica true.
   */
  estimated: boolean;
}

/**
 * Valores da cobranca online para o metodo escolhido.
 * - Repasse desligado: o aluno paga o valor da cobranca; tarifa e taxa saem do espaco.
 * - Repasse ligado: o aluno paga valor + tarifa + taxa; o espaco recebe o valor.
 * No link, que aceita varios meios, usa-se o meio de maior custo para o valor
 * em questao (no repasse ligado, o maior valor cobrado), para o espaco nunca
 * receber menos que o previsto.
 */
export function calculateOnlineChargeAmounts(params: {
  amountCents: number;
  method: OnlinePaymentMethodKind;
  splitAmountCents: number;
  passFee: boolean;
  fees?: GatewayFeeTable;
}): OnlineChargeAmounts {
  const { amountCents, method, splitAmountCents, passFee } = params;
  const fees = params.fees ?? ASAAS_FEES;
  if (amountCents <= 0) {
    return {
      chargedAmountCents: 0,
      gatewayFeeCents: 0,
      splitAmountCents: 0,
      totalFeeCents: 0,
      netAmountCents: 0,
      estimated: false,
    };
  }

  const candidates: GatewayFee[] =
    method === "pix" ? [fees.pix] : fees.linkMethods.map((m) => fees[m]);
  const estimated = candidates.length > 1;

  if (!passFee) {
    const gateway = Math.max(...candidates.map((f) => gatewayFeeCents(f, amountCents)));
    return {
      chargedAmountCents: amountCents,
      gatewayFeeCents: gateway,
      splitAmountCents,
      totalFeeCents: gateway + splitAmountCents,
      netAmountCents: Math.max(0, amountCents - gateway - splitAmountCents),
      estimated,
    };
  }

  const charged = Math.max(...candidates.map((f) => grossUp(f, amountCents, splitAmountCents)));
  const gateway = Math.max(...candidates.map((f) => gatewayFeeCents(f, charged)));
  return {
    chargedAmountCents: charged,
    gatewayFeeCents: gateway,
    splitAmountCents,
    totalFeeCents: charged - amountCents,
    netAmountCents: charged - gateway - splitAmountCents,
    estimated,
  };
}
