import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASAAS_FEES,
  calculateOnlineChargeAmounts,
  gatewayFeeCents,
  platformSplitCents,
} from "../src/payment-fees.ts";

describe("tarifas da cobrança online (doc 19 §4, decisão A)", () => {
  it("split do GestaraHub por plano: R$ 1,99 no Grátis, R$ 1,29 no Profissional e no Expansão", () => {
    assert.equal(platformSplitCents(undefined), 199);
    assert.equal(platformSplitCents("free"), 199);
    assert.equal(platformSplitCents("pro"), 129);
    assert.equal(platformSplitCents("scale"), 129);
  });

  it("tarifa por meio: Pix fixa, cartão percentual + fixo, nada sobre zero", () => {
    assert.equal(gatewayFeeCents(ASAAS_FEES.pix, 4000), 199);
    assert.equal(gatewayFeeCents(ASAAS_FEES.creditCard, 4000), 80 + 49);
    assert.equal(gatewayFeeCents(ASAAS_FEES.creditCard, 0), 0);
  });

  it("Pix sem repasse: aluno paga o valor; tarifa e taxa saem do espaço", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "pix", splitAmountCents: 129, passFee: false });
    assert.deepEqual(r, {
      chargedAmountCents: 4000,
      gatewayFeeCents: 199,
      splitAmountCents: 129,
      totalFeeCents: 328,
      netAmountCents: 3672,
      estimated: false,
    });
  });

  it("Pix com repasse: aluno paga valor + tarifa + taxa; espaço recebe o valor", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "pix", splitAmountCents: 129, passFee: true });
    assert.equal(r.chargedAmountCents, 4328);
    assert.equal(r.netAmountCents, 4000);
    assert.equal(r.totalFeeCents, 328);
  });

  it("link sem repasse: a pior tarifa entre crédito e débito é o crédito (1,99% + R$ 0,49)", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 4000, method: "link", splitAmountCents: 129, passFee: false });
    assert.equal(r.gatewayFeeCents, 80 + 49);
    assert.equal(r.netAmountCents, 4000 - 129 - 129);
    assert.equal(r.estimated, true);
  });

  it("link sem repasse em valor alto: segue o crédito", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 30000, method: "link", splitAmountCents: 199, passFee: false });
    assert.equal(r.gatewayFeeCents, 597 + 49);
    assert.equal(r.netAmountCents, 30000 - 646 - 199);
  });

  it("débito é sempre mais barato que crédito, então nunca é o pior caso", () => {
    for (const amount of [100, 4000, 30000, 99999]) {
      assert.ok(gatewayFeeCents(ASAAS_FEES.debitCard, amount) < gatewayFeeCents(ASAAS_FEES.creditCard, amount));
    }
  });

  it("link com repasse: o valor cobrado cobre o pior caso e o líquido nunca fica abaixo do valor", () => {
    for (const amount of [4000, 15000, 30000, 99999]) {
      const r = calculateOnlineChargeAmounts({ amountCents: amount, method: "link", splitAmountCents: 199, passFee: true });
      for (const m of ASAAS_FEES.linkMethods) {
        const net = r.chargedAmountCents - gatewayFeeCents(ASAAS_FEES[m], r.chargedAmountCents) - 199;
        assert.ok(net >= amount, `${m} em ${amount}: líquido ${net}`);
      }
      assert.equal(r.netAmountCents, r.chargedAmountCents - r.gatewayFeeCents - 199);
    }
  });

  it("cartão com repasse: gross-up (valor + taxa + fixo) / (1 - 1,99%), arredondado para cima", () => {
    const r = calculateOnlineChargeAmounts({
      amountCents: 15000,
      method: "link",
      splitAmountCents: 199,
      passFee: true,
      fees: { ...ASAAS_FEES, linkMethods: ["creditCard"] },
    });
    assert.equal(r.chargedAmountCents, 15558);
    assert.equal(r.gatewayFeeCents, Math.round(15558 * 0.0199) + 49);
    assert.ok(r.netAmountCents >= 15000);
    assert.equal(r.estimated, false);
  });

  it("valor zero não gera tarifa", () => {
    const r = calculateOnlineChargeAmounts({ amountCents: 0, method: "pix", splitAmountCents: 199, passFee: true });
    assert.equal(r.chargedAmountCents, 0);
    assert.equal(r.totalFeeCents, 0);
  });
});
