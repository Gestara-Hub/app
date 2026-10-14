import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StudentDiscount } from "@gestarahub/contracts";
import {
  chargesDueIn,
  firstCharge,
  resolveMembershipTerms,
  upcomingCharges,
  type MembershipTerms,
  type MembershipTermsInput,
  type ScheduledCharge,
} from "../src/billing.ts";

/** Plano de R$ 180, entrada 20/09, antecipado + proporcional, dia 10. */
const terms = (over: Partial<MembershipTermsInput> = {}): MembershipTerms =>
  resolveMembershipTerms({
    period: "monthly",
    planPriceCents: 18000,
    startDate: "2026-09-20",
    strategy: "prorated",
    timing: "prepaid",
    dueDay: 10,
    ...over,
  });

const scholarship = (value: number, validUntil?: string): StudentDiscount => ({
  type: "percentage",
  value,
  scholarship: true,
  validUntil,
});

const brief = (c: ScheduledCharge) =>
  `${c.periodStart} ${c.amountCents}/${c.listAmountCents} ${c.discountApplied ? "bolsa" : "cheio"}`;

describe("resolveMembershipTerms com desconto e bolsa", () => {
  it("aplica a bolsa no preço e guarda o valor cheio e a validade", () => {
    const t = terms({ discount: scholarship(50, "2026-11-30") });
    assert.equal(t.priceCents, 9000);
    assert.equal(t.listPriceCents, 18000);
    assert.equal(t.discountValidUntil, "2026-11-30");
  });

  it("sem desconto, valor cheio igual ao preço e sem validade", () => {
    const t = terms();
    assert.equal(t.priceCents, 18000);
    assert.equal(t.listPriceCents, 18000);
    assert.equal(t.discountValidUntil, undefined);
  });

  it("bolsa integral zera o preço", () => {
    const t = terms({ discount: scholarship(100) });
    assert.equal(t.priceCents, 0);
    assert.equal(t.listPriceCents, 18000);
  });

  it("desconto fixo com validade", () => {
    const t = terms({ discount: { type: "fixed", value: 3000, validUntil: "2026-12-31" } });
    assert.equal(t.priceCents, 15000);
    assert.equal(t.listPriceCents, 18000);
    assert.equal(t.discountValidUntil, "2026-12-31");
  });
});

describe("bolsa com validade (Válida até)", () => {
  it("períodos que começam até a validade têm bolsa; depois, valor cheio", () => {
    const charges = upcomingCharges(terms({ discount: scholarship(50, "2026-11-30") }), 5);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 3300/6600 bolsa",
      "2026-10-01 9000/18000 bolsa",
      "2026-11-01 9000/18000 bolsa",
      "2026-12-01 18000/18000 cheio",
      "2027-01-01 18000/18000 cheio",
    ]);
  });

  it("período que começa no próprio dia da validade ainda tem bolsa", () => {
    const charges = upcomingCharges(terms({ discount: scholarship(50, "2026-11-01") }), 4);
    assert.deepEqual(
      charges.map((c) => c.discountApplied),
      [true, true, true, false],
    );
    assert.equal(charges[2].amountCents, 9000);
    assert.equal(charges[3].amountCents, 18000);
  });

  it("validade no meio do período mantém a bolsa naquele período inteiro", () => {
    const charges = upcomingCharges(terms({ discount: scholarship(50, "2026-10-15") }), 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 3300/6600 bolsa",
      "2026-10-01 9000/18000 bolsa",
      "2026-11-01 18000/18000 cheio",
    ]);
  });

  it("1º período proporcional após a validade cobra o cheio na mesma proporção", () => {
    const c = firstCharge(terms({ discount: scholarship(50, "2026-09-10") }));
    assert.equal(c.isProrated, true);
    assert.equal(c.proratedDays, 11);
    assert.equal(c.discountApplied, false);
    assert.equal(c.listAmountCents, 6600);
    assert.equal(c.amountCents, 6600);
  });

  it("1º período proporcional com bolsa guarda a proporção nos dois valores", () => {
    const c = firstCharge(terms({ discount: scholarship(50, "2026-12-31") }));
    assert.equal(c.isProrated, true);
    assert.equal(c.proratedDays, 11);
    assert.equal(c.discountApplied, true);
    assert.equal(c.amountCents, 3300);
    assert.equal(c.listAmountCents, 6600);
  });

  it("sem validade, a bolsa vale para sempre", () => {
    const charges = upcomingCharges(terms({ discount: scholarship(50) }), 24);
    assert.ok(charges.every((c) => c.discountApplied));
    assert.ok(charges.slice(1).every((c) => c.amountCents === 9000 && c.listAmountCents === 18000));
  });

  it("bolsa integral: R$ 0 com valor de referência, cheio depois da validade", () => {
    const charges = upcomingCharges(terms({ discount: scholarship(100, "2026-10-31") }), 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 0/6600 bolsa",
      "2026-10-01 0/18000 bolsa",
      "2026-11-01 18000/18000 cheio",
    ]);
  });

  it("desconto fixo segue a mesma validade", () => {
    const charges = upcomingCharges(
      terms({ discount: { type: "fixed", value: 3000, validUntil: "2026-10-31" } }),
      3,
    );
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 5500/6600 bolsa",
      "2026-10-01 15000/18000 bolsa",
      "2026-11-01 18000/18000 cheio",
    ]);
  });
});

describe("validade conta pelo início do período, não pelo vencimento", () => {
  it("depois do uso: período de outubro vence em novembro e ainda tem bolsa", () => {
    const t = terms({ timing: "postpaid", discount: scholarship(50, "2026-10-31") });
    const nov = chargesDueIn(t, "2026-11");
    assert.equal(nov.length, 1);
    assert.equal(nov[0].periodStart, "2026-10-01");
    assert.equal(nov[0].dueDate, "2026-11-10");
    assert.equal(nov[0].discountApplied, true);
    assert.equal(nov[0].amountCents, 9000);

    const dec = chargesDueIn(t, "2026-12")[0];
    assert.equal(dec.periodStart, "2026-11-01");
    assert.equal(dec.discountApplied, false);
    assert.equal(dec.amountCents, 18000);
  });

  it("mês cheio: ciclo que começa depois da validade paga cheio", () => {
    const t = terms({ strategy: "full_cycle", dueDay: undefined, discount: scholarship(50, "2026-10-19") });
    const charges = upcomingCharges(t, 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 9000/18000 bolsa",
      "2026-10-20 18000/18000 cheio",
      "2026-11-20 18000/18000 cheio",
    ]);
  });

  it("semanal: semanas que começam depois da validade pagam cheio", () => {
    const t = terms({ period: "weekly", planPriceCents: 4500, discount: scholarship(50, "2026-10-03") });
    const charges = upcomingCharges(t, 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 2250/4500 bolsa",
      "2026-09-27 2250/4500 bolsa",
      "2026-10-04 4500/4500 cheio",
    ]);
  });

  it("quinzenal proporcional: 1ª quinzena parcial mantém a proporção nos dois valores", () => {
    const t = terms({ period: "biweekly", planPriceCents: 8000, discount: scholarship(50, "2026-09-30") });
    const charges = upcomingCharges(t, 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 2933/5867 bolsa",
      "2026-10-01 8000/8000 cheio",
      "2026-10-16 8000/8000 cheio",
    ]);
    assert.equal(charges[0].proratedDays, 11);
  });
});

describe("sem desconto", () => {
  it("valor cheio igual ao cobrado e sem bolsa", () => {
    const charges = upcomingCharges(terms(), 3);
    assert.deepEqual(charges.map(brief), [
      "2026-09-20 6600/6600 cheio",
      "2026-10-01 18000/18000 cheio",
      "2026-11-01 18000/18000 cheio",
    ]);
  });

  it("termos montados sem listPriceCents usam o próprio preço como valor cheio", () => {
    const t: MembershipTerms = {
      period: "monthly",
      priceCents: 15000,
      startDate: "2026-09-20",
      timing: "prepaid",
      strategy: "prorated",
      dueDay: 10,
    };
    const charges = upcomingCharges(t, 2);
    assert.deepEqual(charges.map(brief), ["2026-09-20 5500/5500 cheio", "2026-10-01 15000/15000 cheio"]);
  });

  it("desconto zerado não conta como desconto", () => {
    const c = firstCharge(terms({ discount: { type: "percentage", value: 0, validUntil: "2026-12-31" } }));
    assert.equal(c.discountApplied, false);
    assert.equal(c.amountCents, c.listAmountCents);
  });

  it("validade sem diferença de preço é ignorada", () => {
    const t: MembershipTerms = { ...terms(), discountValidUntil: "2026-09-01" };
    const charges = upcomingCharges(t, 2);
    assert.ok(charges.every((c) => !c.discountApplied && c.amountCents === c.listAmountCents));
  });
});
