import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASAAS_BILLING_TYPE,
  ASAAS_FEES,
  areGatewayFeesStale,
  availableOnlineMethods,
  defaultPassFeeFor,
  calculateOnlineChargeAmounts,
  effectiveGatewayFees,
  gatewayFeeCents,
  isGatewayFeeDivergent,
  linkMethodFromAsaasBillingType,
  onlineFundsLabel,
  onlinePaymentMethodLabel,
  pixWithdrawalRuleText,
  parseAsaasAccountFees,
  platformSplitCents,
  type GatewayFeeTable,
} from "../src/payment-fees.ts";

/** Tabela da subconta no sandbox em 21/10/2026, ja com a promocao. */
const PROMO: GatewayFeeTable = {
  pix: { percent: 0, fixedCents: 99 },
  boleto: { percent: 0, fixedCents: 99 },
  creditCard: { percent: 0.0199, fixedCents: 49 },
  debitCard: { percent: 0.0189, fixedCents: 35 },
  linkMethods: ["creditCard", "debitCard"],
};

/** Resposta real de GET /v3/myAccount/fees (sandbox, 21/10/2026), so os campos usados. */
const ASAAS_RESPONSE = {
  payment: {
    bankSlip: { defaultValue: 1.99, discountValue: 0.99, expirationDate: "2027-01-20 00:00:00" },
    creditCard: {
      operationValue: 0.49,
      oneInstallmentPercentage: 2.99,
      hasValidDiscount: true,
      discountOneInstallmentPercentage: 1.99,
      discountExpiration: "2027-01-20 00:00:00",
    },
    debitCard: { operationValue: 0.35, defaultPercentage: 1.89 },
    pix: {
      fixedFeeValue: 1.99,
      fixedFeeValueWithDiscount: 0.99,
      percentageFee: null,
      discountExpiration: "2027-01-20 00:00:00",
    },
  },
};

describe("tarifas da cobrança online (doc 19 §4, decisão A)", () => {
  it("split do GestaraHub por plano: R$ 1,99 no Grátis, R$ 1,29 no Profissional e no Expansão", () => {
    assert.equal(platformSplitCents(undefined), 199);
    assert.equal(platformSplitCents("free"), 199);
    assert.equal(platformSplitCents("pro"), 129);
    assert.equal(platformSplitCents("scale"), 129);
  });

  it("tarifa por meio: Pix fixa, cartão percentual + fixo, nada sobre zero", () => {
    assert.equal(gatewayFeeCents(PROMO.pix, 4000), 99);
    // O Asaas trunca a parte percentual: 1,99% de R$ 40,00 = 0,796 -> 0,79.
    assert.equal(gatewayFeeCents(PROMO.creditCard, 4000), 79 + 49);
    assert.equal(gatewayFeeCents(PROMO.creditCard, 0), 0);
  });

  it("tarifa do cartão igual à do Asaas (8 valores reais do sandbox, 21/10/2026)", () => {
    const credit = { percent: 0.0199, fixedCents: 49 };
    const real: Array<[number, number]> = [
      [4263, 133], [1000, 68], [3333, 115], [15075, 348], [9999, 247], [123456, 2505], [5750, 163], [1890, 86],
    ];
    for (const [charged, fee] of real) assert.equal(gatewayFeeCents(credit, charged), fee, `R$ ${charged / 100}`);
  });

  it("repasse fecha exatamente no valor da cobrança (caso da Victoria: R$ 40,00)", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "link", splitAmountCents: 129, passFee: true, fees: PROMO });
    assert.equal(r.chargedAmountCents, 4262);
    assert.equal(r.gatewayFeeCents, 133);
    assert.equal(r.netAmountCents, 4000);
  });

  it("valor percentual exato não perde 1 centavo no ponto flutuante", () => {
    assert.equal(gatewayFeeCents({ percent: 0.0299, fixedCents: 0 }, 10000), 299);
  });

  it("piso e teto da tarifa percentual", () => {
    const fee = { percent: 0.01, fixedCents: 0, minCents: 50, maxCents: 300 };
    assert.equal(gatewayFeeCents(fee, 1000), 50);
    assert.equal(gatewayFeeCents(fee, 10000), 100);
    assert.equal(gatewayFeeCents(fee, 100000), 300);
  });

  it("Pix sem repasse: aluno paga o valor; tarifa e taxa saem do espaço", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "pix", splitAmountCents: 129, passFee: false, fees: PROMO });
    assert.deepEqual(r, {
      chargedAmountCents: 4000,
      gatewayFeeCents: 99,
      splitAmountCents: 129,
      totalFeeCents: 228,
      netAmountCents: 3772,
      estimated: false,
      byMethod: [{ method: "pix", gatewayFeeCents: 99, netAmountCents: 3772 }],
    });
  });

  it("Pix com repasse: aluno paga valor + tarifa + taxa; espaço recebe o valor", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "pix", splitAmountCents: 129, passFee: true, fees: PROMO });
    assert.equal(r.chargedAmountCents, 4228);
    assert.equal(r.netAmountCents, 4000);
    assert.equal(r.totalFeeCents, 228);
  });

  it("link sem repasse: a pior tarifa entre crédito e débito é o crédito", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "link", splitAmountCents: 129, passFee: false, fees: PROMO });
    assert.equal(r.gatewayFeeCents, 79 + 49);
    assert.equal(r.netAmountCents, 4000 - 128 - 129);
    assert.equal(r.estimated, true);
  });

  it("link com repasse: o valor cobrado cobre o pior caso e o líquido nunca fica abaixo do valor", () => {
    for (const fees of [PROMO, ASAAS_FEES]) {
      for (const amount of [4000, 15000, 30000, 99999]) {
        const r = calculateOnlineChargeAmounts({ amountCents: amount, method: "link", splitAmountCents: 199, passFee: true, fees });
        for (const m of fees.linkMethods) {
          const net = r.chargedAmountCents - gatewayFeeCents(fees[m], r.chargedAmountCents) - 199;
          assert.ok(net >= amount, `${m} em ${amount}: líquido ${net}`);
        }
        assert.equal(r.netAmountCents, r.chargedAmountCents - r.gatewayFeeCents - 199);
      }
    }
  });

  it("cartão com repasse: menor valor que cobre as taxas; o líquido fecha no valor", () => {
    const r = calculateOnlineChargeAmounts({
      amountCents: 15000,
      method: "link",
      splitAmountCents: 199,
      passFee: true,
      fees: { ...PROMO, linkMethods: ["creditCard"] },
    });
    assert.equal(r.chargedAmountCents, 15557);
    assert.equal(r.gatewayFeeCents, Math.floor(15557 * 0.0199) + 49);
    assert.equal(r.netAmountCents, 15000);
    assert.equal(r.estimated, false);
  });

  it("link lista crédito e débito sobre o mesmo valor cobrado, do mais caro ao mais barato", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "link", splitAmountCents: 129, passFee: true, fees: PROMO });
    assert.deepEqual(
      r.byMethod.map((m) => m.method),
      ["creditCard", "debitCard"],
    );
    const [credit, debit] = r.byMethod;
    assert.equal(credit.gatewayFeeCents, r.gatewayFeeCents);
    assert.equal(credit.netAmountCents, 4000);
    assert.ok(debit.netAmountCents > 4000);
  });

  it("sem tabela informada usa a reserva (padrão do Asaas, sem promoção)", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "pix", splitAmountCents: 199, passFee: false });
    assert.equal(r.gatewayFeeCents, 199);
    assert.equal(ASAAS_FEES.creditCard.percent, 0.0299);
  });

  it("billingType do Asaas vira o meio usado", () => {
    assert.equal(linkMethodFromAsaasBillingType("CREDIT_CARD"), "creditCard");
    assert.equal(linkMethodFromAsaasBillingType("DEBIT_CARD"), "debitCard");
    assert.equal(linkMethodFromAsaasBillingType("PIX"), "pix");
    assert.equal(linkMethodFromAsaasBillingType("UNDEFINED"), undefined);
  });

  it("valor zero não gera tarifa", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 0, method: "pix", splitAmountCents: 199, passFee: true });
    assert.equal(r.chargedAmountCents, 0);
    assert.equal(r.totalFeeCents, 0);
  });
});

describe("tarifas da subconta (GET /myAccount/fees)", () => {
  const fees = parseAsaasAccountFees(ASAAS_RESPONSE, "2026-10-21T15:00:00.000Z");

  it("lê a tabela crua com o valor cheio, a promoção e a data de fim", () => {
    assert.deepEqual(fees.pix, { percent: 0, fixedCents: 199, promo: { percent: 0, fixedCents: 99 }, promoUntil: "2027-01-20" });
    assert.deepEqual(fees.creditCard, {
      percent: 0.0299,
      fixedCents: 49,
      promo: { percent: 0.0199, fixedCents: 49 },
      promoUntil: "2027-01-20",
    });
    assert.deepEqual(fees.debitCard, { percent: 0.0189, fixedCents: 35 });
    assert.deepEqual(fees.boleto, { percent: 0, fixedCents: 199, promo: { percent: 0, fixedCents: 99 }, promoUntil: "2027-01-20" });
    assert.equal(fees.syncedAt, "2026-10-21T15:00:00.000Z");
  });

  it("a promoção vale até a véspera do fim; no dia do fim volta o valor cheio", () => {
    const during = effectiveGatewayFees(fees, "2027-01-19");
    assert.equal(during.pix.fixedCents, 99);
    assert.equal(during.creditCard.percent, 0.0199);
    const after = effectiveGatewayFees(fees, "2027-01-20");
    assert.equal(after.pix.fixedCents, 199);
    assert.equal(after.creditCard.percent, 0.0299);
    assert.equal(after.debitCard.percent, 0.0189);
  });

  it("sem tabela gravada, a efetiva é a reserva", () => {
    assert.equal(effectiveGatewayFees(undefined, "2026-10-21"), ASAAS_FEES);
  });

  it("campo ausente na resposta cai na reserva daquele meio, nunca em zero", () => {
    const partial = parseAsaasAccountFees({ payment: { pix: { fixedFeeValue: 1.49 } } }, "2026-10-21T15:00:00.000Z");
    assert.equal(partial.pix.fixedCents, 149);
    assert.equal(partial.creditCard.percent, ASAAS_FEES.creditCard.percent);
    assert.equal(partial.debitCard.fixedCents, ASAAS_FEES.debitCard.fixedCents);
    assert.equal(partial.boleto.fixedCents, ASAAS_FEES.boleto.fixedCents);
  });

  it("Pix percentual com piso e teto", () => {
    const pct = parseAsaasAccountFees(
      { payment: { pix: { percentageFee: 0.99, minimumFeeValue: 0.29, maximumFeeValue: 5 } } },
      "2026-10-21T15:00:00.000Z",
    );
    assert.deepEqual(pct.pix, { percent: 0.0099, fixedCents: 0, minCents: 29, maxCents: 500 });
  });

  it("tabela passa de 24 horas: hora de buscar de novo", () => {
    assert.equal(areGatewayFeesStale(undefined, new Date("2026-10-21T15:00:00Z")), true);
    assert.equal(areGatewayFeesStale(fees, new Date("2026-10-22T14:59:00Z")), false);
    assert.equal(areGatewayFeesStale(fees, new Date("2026-10-22T15:01:00Z")), true);
  });

  it("divergência: a tarifa real do pagamento não bate com a tabela (tolerância de 1 centavo)", () => {
    const table = effectiveGatewayFees(fees, "2026-10-21");
    const expected = gatewayFeeCents(table.creditCard, 12426);
    assert.equal(isGatewayFeeDivergent(table, "creditCard", 12426, expected), false);
    assert.equal(isGatewayFeeDivergent(table, "creditCard", 12426, expected + 1), false);
    assert.equal(isGatewayFeeDivergent(table, "creditCard", 12426, expected + 50), true);
    assert.equal(isGatewayFeeDivergent(table, "pix", 4000, 199), true);
  });
});

describe("formas de cobrança online (21/10/2026)", () => {
  it("padrão: Pix e cartão; boleto desligado; sem 'o aluno escolhe'", () => {
    assert.deepEqual(availableOnlineMethods(undefined), ["pix", "link"]);
  });

  it("'o aluno escolhe' só com as três ligadas", () => {
    assert.deepEqual(availableOnlineMethods({ acceptedMethods: { pix: true, card: true, boleto: true } }), [
      "pix",
      "link",
      "boleto",
      "choice",
    ]);
    assert.deepEqual(availableOnlineMethods({ acceptedMethods: { pix: true, card: false, boleto: true } }), ["pix", "boleto"]);
    assert.deepEqual(availableOnlineMethods({ acceptedMethods: { pix: false, card: true, boleto: false } }), ["link"]);
  });

  it("billingType do Asaas por forma", () => {
    assert.equal(ASAAS_BILLING_TYPE.pix, "PIX");
    assert.equal(ASAAS_BILLING_TYPE.link, "CREDIT_CARD");
    assert.equal(ASAAS_BILLING_TYPE.boleto, "BOLETO");
    assert.equal(ASAAS_BILLING_TYPE.choice, "UNDEFINED");
  });

  it("repasse por forma, com o geral como padrão", () => {
    assert.equal(defaultPassFeeFor({ enabled: true, passFeeToCustomer: true }, "boleto"), true);
    assert.equal(defaultPassFeeFor({ enabled: true, passFeeToCustomer: true, passFeeBoleto: false }, "boleto"), false);
    assert.equal(defaultPassFeeFor({ enabled: true, passFeeChoice: true }, "choice"), true);
    assert.equal(defaultPassFeeFor(undefined, "pix"), false);
  });

  it("boleto: faixa entre boleto e Pix; o aluno escolhe: entre os quatro meios", () => {
    const boleto = calculateOnlineChargeAmounts({ amountCents: 15000, method: "boleto", splitAmountCents: 129, passFee: false, fees: PROMO });
    assert.deepEqual(
      boleto.byMethod.map((m) => m.method).sort(),
      ["boleto", "pix"],
    );
    const choice = calculateOnlineChargeAmounts({ amountCents: 15000, method: "choice", splitAmountCents: 129, passFee: true, fees: PROMO });
    assert.equal(choice.byMethod.length, 4);
    assert.equal(choice.byMethod[0].method, "creditCard");
    for (const m of choice.byMethod) assert.ok(m.netAmountCents >= 15000);
  });
});

describe("rótulos do pagamento online (achado 62)", () => {
  it("a forma sai igual na tela e no extrato", () => {
    assert.equal(onlinePaymentMethodLabel("pix"), "Pix");
    assert.equal(onlinePaymentMethodLabel("pix", "pix"), "Pix");
    assert.equal(onlinePaymentMethodLabel("link"), "Cartão");
    assert.equal(onlinePaymentMethodLabel("link", "creditCard"), "Cartão · Crédito");
    assert.equal(onlinePaymentMethodLabel("boleto"), "Boleto");
  });

  it("o saldo diz Disponível, a data prevista ou A liberar", () => {
    const fmt = (d: string) => d.split("-").reverse().join("/");
    assert.equal(onlineFundsLabel(true, undefined, fmt), "Disponível");
    assert.equal(onlineFundsLabel(false, "2026-11-21", fmt), "Libera em 21/11/2026");
    assert.equal(onlineFundsLabel(false, undefined, fmt), "A liberar");
  });
});

describe("saque via Pix (achado 4)", () => {
  it("a regra do saque tem um texto só", () => {
    assert.equal(pixWithdrawalRuleText(), "30 grátis por mês; depois, R$ 2,00 cada");
    assert.equal(pixWithdrawalRuleText({ freePerMonth: 10, feeCents: 550 }), "10 grátis por mês; depois, R$ 5,50 cada");
  });
});
