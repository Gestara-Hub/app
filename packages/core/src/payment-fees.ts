/**
 * Tarifas da cobranca online (doc 19, secao 4, decisao de 21/10/2026):
 * o espaco paga a tarifa do Asaas (sai da subconta dele) e mais a taxa do
 * GestaraHub (split fixo por cobranca, retido na liquidacao). Com o repasse
 * ligado, o aluno paga um valor maior que cobre as duas e o espaco recebe
 * exatamente o valor da cobranca.
 *
 * Tudo em centavos. Os percentuais sao fracoes (1,99% = 0.0199).
 */

import type {
  DateISO,
  DateTimeISO,
  GatewayAccountFees,
  GatewayFeeRule,
  GatewayFeeWithPromo,
  LinkPaymentMethodName,
  AcceptedOnlineMethods,
  OnlinePaymentMethod,
  OnlinePaymentSettings,
} from "@gestarahub/contracts";

export type OnlinePaymentMethodKind = OnlinePaymentMethod;
/** Meio efetivamente usado pelo aluno (Pix direto ou o que escolheu na fatura do link). */
export type LinkPaymentMethod = LinkPaymentMethodName;
export type PlatformTier = "free" | "pro" | "scale";

/** Tarifa de um meio de pagamento: percentual sobre o valor mais um fixo, com piso e teto opcionais. */
export type GatewayFee = GatewayFeeRule;

/**
 * Tabela de tarifas efetiva (ja com a promocao do dia, se houver).
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
  linkMethods: ReadonlyArray<LinkPaymentMethod>;
}

const LINK_METHODS: ReadonlyArray<LinkPaymentMethod> = ["creditCard", "debitCard"];

/**
 * Reserva: tabela padrao do Asaas sem promocao (21/10/2026). Vale so quando a
 * subconta ainda nao tem a propria tabela gravada ou a busca falhou. Sem
 * promocao de proposito: na duvida, a previa mostra taxa a mais, nunca a menos.
 */
export const ASAAS_FEES: GatewayFeeTable = {
  pix: { percent: 0, fixedCents: 199 },
  boleto: { percent: 0, fixedCents: 199 },
  creditCard: { percent: 0.0299, fixedCents: 49 },
  debitCard: { percent: 0.0189, fixedCents: 35 },
  linkMethods: LINK_METHODS,
};

/** Intervalo de atualizacao das tarifas da subconta (decisao de 21/10/2026). */
export const GATEWAY_FEES_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Tabela gravada passou de 24 horas (ou nao existe): hora de buscar de novo. */
export function areGatewayFeesStale(fees: GatewayAccountFees | undefined, now: Date): boolean {
  if (!fees?.syncedAt) return true;
  return now.getTime() - new Date(fees.syncedAt).getTime() > GATEWAY_FEES_MAX_AGE_MS;
}

function effectiveRule(rule: GatewayFeeWithPromo, today: DateISO): GatewayFee {
  const promoValid = rule.promo && (!rule.promoUntil || today < rule.promoUntil);
  const chosen = promoValid ? rule.promo! : rule;
  return {
    percent: chosen.percent,
    fixedCents: chosen.fixedCents,
    ...(chosen.minCents !== undefined ? { minCents: chosen.minCents } : {}),
    ...(chosen.maxCents !== undefined ? { maxCents: chosen.maxCents } : {}),
  };
}

/**
 * Tabela efetiva da subconta no dia: promocao enquanto valer, depois o valor
 * cheio. Sem tabela gravada, a reserva `ASAAS_FEES`.
 */
export function effectiveGatewayFees(fees: GatewayAccountFees | undefined, today: DateISO): GatewayFeeTable {
  if (!fees) return ASAAS_FEES;
  return {
    pix: effectiveRule(fees.pix, today),
    boleto: effectiveRule(fees.boleto, today),
    creditCard: effectiveRule(fees.creditCard, today),
    debitCard: effectiveRule(fees.debitCard, today),
    linkMethods: LINK_METHODS,
  };
}

// --- Leitura da resposta do Asaas (GET /myAccount/fees) ---------------------

const toCents = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : undefined;
/** 2,99 (%) -> 0.0299, sem o resto de ponto flutuante de 2.99 / 100. */
const toFraction = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 10000 : undefined;
/** "2027-01-20 00:00:00" -> "2027-01-20". */
const toDate = (value: unknown): DateISO | undefined =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;

type Raw = Record<string, unknown> | undefined;

/**
 * Converte a resposta de `GET /v3/myAccount/fees` na tabela crua do contrato.
 * Campo ausente cai na reserva daquele meio, para nunca gravar taxa zero por engano.
 */
export function parseAsaasAccountFees(response: unknown, syncedAt: DateTimeISO): GatewayAccountFees {
  const payment = ((response as Raw)?.payment ?? {}) as Record<string, Raw>;

  const pix = payment.pix;
  const pixPercent = toFraction(pix?.percentageFee);
  const pixFixed = toCents(pix?.fixedFeeValue);
  const pixPromo = toCents(pix?.fixedFeeValueWithDiscount);
  const pixRule: GatewayFeeWithPromo =
    pixPercent !== undefined
      ? {
          percent: pixPercent,
          fixedCents: 0,
          ...(toCents(pix?.minimumFeeValue) !== undefined ? { minCents: toCents(pix?.minimumFeeValue) } : {}),
          ...(toCents(pix?.maximumFeeValue) !== undefined ? { maxCents: toCents(pix?.maximumFeeValue) } : {}),
        }
      : { percent: 0, fixedCents: pixFixed ?? ASAAS_FEES.pix.fixedCents };
  if (pixPromo !== undefined && pixPercent === undefined) {
    pixRule.promo = { percent: 0, fixedCents: pixPromo };
    const until = toDate(pix?.discountExpiration);
    if (until) pixRule.promoUntil = until;
  }

  const credit = payment.creditCard;
  const creditFixed = toCents(credit?.operationValue) ?? ASAAS_FEES.creditCard.fixedCents;
  const creditRule: GatewayFeeWithPromo = {
    percent: toFraction(credit?.oneInstallmentPercentage) ?? ASAAS_FEES.creditCard.percent,
    fixedCents: creditFixed,
  };
  const creditPromo = toFraction(credit?.discountOneInstallmentPercentage);
  if (credit?.hasValidDiscount === true && creditPromo !== undefined) {
    creditRule.promo = { percent: creditPromo, fixedCents: creditFixed };
    const until = toDate(credit?.discountExpiration);
    if (until) creditRule.promoUntil = until;
  }

  const debit = payment.debitCard;
  const debitRule: GatewayFeeWithPromo = {
    percent: toFraction(debit?.defaultPercentage) ?? ASAAS_FEES.debitCard.percent,
    fixedCents: toCents(debit?.operationValue) ?? ASAAS_FEES.debitCard.fixedCents,
  };

  const slip = payment.bankSlip;
  const boletoRule: GatewayFeeWithPromo = {
    percent: 0,
    fixedCents: toCents(slip?.defaultValue) ?? ASAAS_FEES.boleto.fixedCents,
  };
  const slipPromo = toCents(slip?.discountValue);
  if (slipPromo !== undefined) {
    boletoRule.promo = { percent: 0, fixedCents: slipPromo };
    const until = toDate(slip?.expirationDate);
    if (until) boletoRule.promoUntil = until;
  }

  return { pix: pixRule, creditCard: creditRule, debitCard: debitRule, boleto: boletoRule, syncedAt };
}

/**
 * A tarifa real do pagamento (webhook) bate com a tabela? Tolerancia de 1
 * centavo para arredondamento. Divergiu: a tarifa da subconta mudou e a
 * tabela precisa ser buscada de novo.
 */
export function isGatewayFeeDivergent(
  table: GatewayFeeTable,
  method: LinkPaymentMethod,
  chargedCents: number,
  realFeeCents: number,
): boolean {
  return Math.abs(gatewayFeeCents(table[method], chargedCents) - realFeeCents) > 1;
}

/**
 * Taxa do GestaraHub por cobranca online recebida (doc 13, decidido em
 * 26/11/2026): percentual do valor da cobranca, com minimo e teto. Mais leve
 * que a taxa fixa nas cobrancas pequenas, parecida na faixa de R$ 100 a R$ 150 e
 * maior nas grandes. Antes: R$ 1,99 (Gratis) e R$ 1,29 (planos pagos) fixos.
 */
export interface PlatformFeeRule {
  /** Percentual sobre o valor da cobranca (1,5 = 1,5%). */
  percent: number;
  minCents: number;
  maxCents: number;
}

export const PLATFORM_FEE_RULES: Record<PlatformTier, PlatformFeeRule> = {
  free: { percent: 1.5, minCents: 99, maxCents: 990 },
  pro: { percent: 1, minCents: 69, maxCents: 690 },
  scale: { percent: 1, minCents: 69, maxCents: 690 },
};

/**
 * Taxa do GestaraHub sobre uma cobranca (centavos): o percentual do valor da
 * cobranca (o que o espaco cobra, sem a taxa repassada ao aluno), arredondado,
 * entre o minimo e o teto do plano.
 */
export function platformSplitCents(tier: PlatformTier | undefined, amountCents: number): number {
  const rule = PLATFORM_FEE_RULES[tier ?? "free"];
  const percentCents = Math.round((Math.max(0, amountCents) * rule.percent) / 100);
  return Math.min(rule.maxCents, Math.max(rule.minCents, percentCents));
}

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const percentLabel = (percent: number) => `${String(percent).replace(".", ",")}%`;

/** So o percentual do plano: "1,5%". */
export function platformFeePercentText(tier: PlatformTier | undefined): string {
  return percentLabel(PLATFORM_FEE_RULES[tier ?? "free"].percent);
}

/** Minimo e teto do plano: "de R$ 0,99 a R$ 9,90". */
export function platformFeeRangeText(tier: PlatformTier | undefined): string {
  const rule = PLATFORM_FEE_RULES[tier ?? "free"];
  return `de ${brl(rule.minCents)} a ${brl(rule.maxCents)}`;
}

/** A regra do plano numa frase curta: "1,5% por cobrança, de R$ 0,99 a R$ 9,90". */
export function platformFeeRuleText(tier: PlatformTier | undefined): string {
  const rule = PLATFORM_FEE_RULES[tier ?? "free"];
  return `${percentLabel(rule.percent)} por cobrança, de ${brl(rule.minCents)} a ${brl(rule.maxCents)}`;
}

/**
 * A frase da taxa do GestaraHub, a mesma em Planos, Recebimentos online e no
 * checkout (achado 18, decisao de 24/10). Os valores vem de `PLATFORM_FEE_RULES`.
 */
export function platformFeeSentence(): string {
  return `Cada pagamento recebido online: ${platformFeeRuleText("free")} do GestaraHub, mais a tarifa do parceiro de pagamentos.`;
}

/** O item do Profissional na tela de planos: a taxa menor, com a regra. */
export function proPlatformFeeLabel(): string {
  return `Taxa menor por pagamento online: ${platformFeeRuleText("pro")}`;
}

/**
 * Tarifa de um meio sobre um valor cobrado (com piso e teto, se houver). O Asaas
 * TRUNCA a parte percentual (R$ 42,63 a 1,99% = 0,8483 -> 0,84): conferido em
 * 8 valores no sandbox em 21/10/2026. O arredondamento a 6 casas antes do floor
 * tira o resto de ponto flutuante (10000 x 0.0299 = 298.99999...).
 */
export function gatewayFeeCents(fee: GatewayFee, chargedCents: number): number {
  if (chargedCents <= 0) return 0;
  const percentPart = Math.floor(Math.round(chargedCents * fee.percent * 1e6) / 1e6);
  let value = percentPart + fee.fixedCents;
  if (fee.minCents !== undefined) value = Math.max(value, fee.minCents);
  if (fee.maxCents !== undefined) value = Math.min(value, fee.maxCents);
  return value;
}

/**
 * Menor valor cobrado tal que `cobrado - tarifa(cobrado) - split = amount`.
 * Para tarifa so fixa vira soma; com percentual e o gross-up
 * `(amount + split + fixo) / (1 - percentual)`, ajustado para o arredondamento
 * nao deixar o liquido abaixo do valor.
 */
function grossUp(fee: GatewayFee, amountCents: number, splitCents: number): number {
  // Busca binaria do menor valor que cobre tudo. Antes comecava na formula sem
  // teto e so subia: com tarifa percentual com teto (ex.: 0,99% ate R$ 3), o
  // aluno pagava a mais (revisao geral de 31/10/2026, achado V7).
  const netOf = (charged: number) => charged - gatewayFeeCents(fee, charged) - splitCents;
  let lo = amountCents;
  let hi = Math.max(lo, Math.ceil((amountCents + splitCents + fee.fixedCents) / (1 - fee.percent)) + 2);
  while (netOf(hi) < amountCents) hi += Math.max(1, hi - lo);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (netOf(mid) >= amountCents) hi = mid;
    else lo = mid + 1;
  }
  while (netOf(lo) < amountCents) lo += 1;
  return lo;
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
  /**
   * Cada meio possivel com a tarifa e o liquido sobre o mesmo valor cobrado,
   * do mais caro ao mais barato. Um item so no Pix.
   */
  byMethod: Array<{ method: LinkPaymentMethod; gatewayFeeCents: number; netAmountCents: number }>;
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
      byMethod: [],
    };
  }

  const methods = paymentMethodsFor(method, fees);
  const candidates: GatewayFee[] = methods.map((m) => fees[m]);
  const estimated = candidates.length > 1;
  const breakdown = (charged: number) =>
    methods
      .map((m) => {
        const fee = gatewayFeeCents(fees[m], charged);
        return { method: m, gatewayFeeCents: fee, netAmountCents: Math.max(0, charged - fee - splitAmountCents) };
      })
      .sort((a, b) => b.gatewayFeeCents - a.gatewayFeeCents);

  if (!passFee) {
    const gateway = Math.max(...candidates.map((f) => gatewayFeeCents(f, amountCents)));
    return {
      chargedAmountCents: amountCents,
      gatewayFeeCents: gateway,
      splitAmountCents,
      totalFeeCents: gateway + splitAmountCents,
      netAmountCents: Math.max(0, amountCents - gateway - splitAmountCents),
      estimated,
      byMethod: breakdown(amountCents),
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
    byMethod: breakdown(charged),
  };
}

/** Rotulo curto do meio usado ("Crédito", "Débito"...), para a tela. */
export const LINK_PAYMENT_METHOD_LABEL: Record<LinkPaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  creditCard: "Crédito",
  debitCard: "Débito",
};

/**
 * Saque via Pix da subconta: cota grátis por mês e tarifa depois dela (tabela
 * do Asaas em 21/10/2026; a conta real devolve os valores em `myAccount/fees`,
 * campos `transfer.monthlyTransfersWithoutFee` e `transfer.pix.feeValue`).
 * Uma regra só para todas as telas (achado 4 do teste de 23/10).
 */
export const PIX_WITHDRAWAL = { freePerMonth: 30, feeCents: 200 } as const;

/** "30 grátis por mês; depois, R$ 2,00 cada" */
export function pixWithdrawalRuleText(rule: { freePerMonth: number; feeCents: number } = PIX_WITHDRAWAL): string {
  const fee = `R$ ${(rule.feeCents / 100).toFixed(2).replace(".", ",")}`;
  return `${rule.freePerMonth} grátis por mês; depois, ${fee} cada`;
}

/**
 * Forma do pagamento online como a tela de Recebimentos online e o extrato em
 * PDF mostram: "Pix", "Cartão · Crédito", "Boleto". Um texto so nos dois
 * (achado 62 do teste de 23/10).
 */
export function onlinePaymentMethodLabel(method: string, paidMethod?: LinkPaymentMethod | null): string {
  if (method === "pix") return "Pix";
  const base = (ONLINE_METHOD_LABEL as Record<string, string>)[method] ?? "Link";
  const used = paidMethod ? LINK_PAYMENT_METHOD_LABEL[paidMethod] : undefined;
  // "Boleto · Boleto" repetia (26/11/2026): o meio usado so entra quando diz algo a mais.
  return used && used !== base ? `${base} · ${used}` : base;
}

/**
 * Saldo de um pagamento confirmado: "Disponível" (liberado), "Libera em ..."
 * (cartao com data prevista) ou "A liberar" (sem data ainda). `formatDate`
 * escreve a data como cada tela precisa.
 */
export function onlineFundsLabel(
  fundsReleased: boolean,
  creditDate: string | undefined | null,
  formatDate: (isoDay: string) => string,
  releasedLabel = "Disponível",
): string {
  if (fundsReleased) return releasedLabel;
  return creditDate ? `Libera em ${formatDate(creditDate)}` : "A liberar";
}

/** `billingType` do Asaas (webhook) para o meio usado. */
export function linkMethodFromAsaasBillingType(billingType: string | undefined | null): LinkPaymentMethod | undefined {
  switch ((billingType ?? "").toUpperCase()) {
    case "PIX":
      return "pix";
    case "BOLETO":
      return "boleto";
    case "CREDIT_CARD":
      return "creditCard";
    case "DEBIT_CARD":
      return "debitCard";
    default:
      return undefined;
  }
}

// --- Formas de cobranca online (21/10/2026) -----------------------------------

/**
 * Meios que o aluno pode usar em cada forma. No boleto, a fatura do Asaas
 * costuma trazer tambem um QR de Pix (a confirmar no sandbox), entao conta os dois.
 */
export function paymentMethodsFor(method: OnlinePaymentMethodKind, fees: GatewayFeeTable = ASAAS_FEES): LinkPaymentMethod[] {
  switch (method) {
    case "pix":
      return ["pix"];
    case "boleto":
      return ["boleto", "pix"];
    case "choice":
      return ["pix", "boleto", "creditCard", "debitCard"];
    default:
      return [...fees.linkMethods];
  }
}

/** `billingType` do Asaas para cada forma. */
export const ASAAS_BILLING_TYPE: Record<OnlinePaymentMethod, "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED"> = {
  pix: "PIX",
  link: "CREDIT_CARD",
  boleto: "BOLETO",
  choice: "UNDEFINED",
};

/** Padrao quando o espaco ainda nao escolheu: Pix e cartao sim, boleto nao. */
export const DEFAULT_ACCEPTED_METHODS: AcceptedOnlineMethods = { pix: true, card: true, boleto: false };

export function acceptedMethodsOf(settings: Pick<OnlinePaymentSettings, "acceptedMethods"> | undefined): AcceptedOnlineMethods {
  return { ...DEFAULT_ACCEPTED_METHODS, ...(settings?.acceptedMethods ?? {}) };
}

/**
 * Opcoes da modal Cobrar online, na ordem. "O aluno escolhe" (UNDEFINED) so
 * com as tres ligadas: no Asaas a fatura dele sempre mostra Pix, boleto e cartao.
 */
export function availableOnlineMethods(
  settings: Pick<OnlinePaymentSettings, "acceptedMethods"> | undefined,
): OnlinePaymentMethod[] {
  const accepted = acceptedMethodsOf(settings);
  const list: OnlinePaymentMethod[] = [];
  if (accepted.pix) list.push("pix");
  if (accepted.card) list.push("link");
  if (accepted.boleto) list.push("boleto");
  if (accepted.pix && accepted.card && accepted.boleto) list.push("choice");
  return list;
}

/** Repasse padrao da forma; sem configuracao propria, o geral (`passFeeToCustomer`). */
export function defaultPassFeeFor(settings: OnlinePaymentSettings | undefined, method: OnlinePaymentMethod): boolean {
  const general = settings?.passFeeToCustomer ?? false;
  const own =
    method === "pix"
      ? settings?.passFeePix
      : method === "link"
        ? settings?.passFeeCard
        : method === "boleto"
          ? settings?.passFeeBoleto
          : settings?.passFeeChoice;
  return Boolean(own ?? general);
}

/** Rotulo da forma, para as telas. */
export const ONLINE_METHOD_LABEL: Record<OnlinePaymentMethod, string> = {
  pix: "Pix",
  link: "Cartão",
  boleto: "Boleto",
  choice: "O aluno escolhe",
};
