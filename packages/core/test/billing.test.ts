import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDiscount,
  chargesDueIn,
  firstCharge,
  upcomingCharges,
  type MembershipTerms,
} from "../src/billing.ts";

const monthly = (over: Partial<MembershipTerms>): MembershipTerms => ({
  period: "monthly",
  priceCents: 15000,
  startDate: "2026-09-20",
  timing: "prepaid",
  strategy: "prorated",
  dueDay: 10,
  ...over,
});

const brief = (c: { dueDate: string; amountCents: number }) => `${c.dueDate} ${c.amountCents}`;
const dueIn = (t: MembershipTerms, comp: string) => chargesDueIn(t, comp).map(brief);

describe("matriz das regras de cobrança (entrada 20/09, R$ 150, dia 10)", () => {
  it("A. antecipado + proporcional", () => {
    const t = monthly({});
    assert.deepEqual(dueIn(t, "2026-09"), ["2026-09-20 5500"]);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-10 15000"]);
    assert.deepEqual(dueIn(t, "2026-11"), ["2026-11-10 15000"]);
  });

  it("B. antecipado + mês cheio (vence no dia da entrada)", () => {
    const t = monthly({ strategy: "full_cycle", dueDay: 20 });
    assert.deepEqual(dueIn(t, "2026-09"), ["2026-09-20 15000"]);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-20 15000"]);
    assert.equal(firstCharge(t).periodEnd, "2026-10-19");
  });

  it("C. depois do uso + proporcional: nada em setembro", () => {
    const t = monthly({ timing: "postpaid" });
    assert.deepEqual(dueIn(t, "2026-09"), []);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-10 5500"]);
    assert.deepEqual(dueIn(t, "2026-11"), ["2026-11-10 15000"]);
    const nov = chargesDueIn(t, "2026-11")[0];
    assert.equal(nov.periodStart, "2026-10-01");
    assert.equal(nov.periodEnd, "2026-10-31");
  });

  it("D. depois do uso + mês cheio: nada em setembro", () => {
    const t = monthly({ timing: "postpaid", strategy: "full_cycle", dueDay: 20 });
    assert.deepEqual(dueIn(t, "2026-09"), []);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-20 15000"]);
    assert.deepEqual(dueIn(t, "2026-11"), ["2026-11-20 15000"]);
  });
});

describe("datas de entrada", () => {
  it("depois do uso + proporcional com entrada antes do vencimento paga só no mês seguinte", () => {
    assert.equal(brief(firstCharge(monthly({ timing: "postpaid", startDate: "2026-09-01" }))), "2026-10-10 15000");
    assert.equal(brief(firstCharge(monthly({ timing: "postpaid", startDate: "2026-09-05" }))), "2026-10-10 13000");
    assert.equal(brief(firstCharge(monthly({ timing: "postpaid", startDate: "2026-09-10" }))), "2026-10-10 10500");
  });

  it("entrada no dia 1 não é proporcional", () => {
    const c = firstCharge(monthly({ startDate: "2026-09-01" }));
    assert.equal(c.isProrated, false);
    assert.equal(c.amountCents, 15000);
  });

  it("proporcional em fevereiro e no ano bissexto", () => {
    assert.equal(firstCharge(monthly({ startDate: "2026-02-28" })).amountCents, 536);
    assert.equal(firstCharge(monthly({ startDate: "2028-02-15" })).amountCents, 7759);
  });

  it("mês cheio no dia 31 cai no último dia dos meses curtos", () => {
    const t = monthly({ strategy: "full_cycle", startDate: "2027-01-31", dueDay: 31 });
    assert.deepEqual(upcomingCharges(t, 3).map((c) => c.dueDate), ["2027-01-31", "2027-02-28", "2027-03-31"]);
    const leap = monthly({ strategy: "full_cycle", startDate: "2028-01-31", dueDay: 31, timing: "postpaid" });
    assert.equal(firstCharge(leap).dueDate, "2028-02-29");
  });

  it("vencimento padrão 31 cai no último dia do mês", () => {
    const t = monthly({ startDate: "2026-01-01", dueDay: 31 });
    assert.deepEqual(dueIn(t, "2026-02"), ["2026-02-28 15000"]);
    assert.deepEqual(dueIn(t, "2026-04"), ["2026-04-30 15000"]);
  });
});

describe("quinzenal", () => {
  const q = (over: Partial<MembershipTerms>): MembershipTerms =>
    monthly({ period: "biweekly", priceCents: 8000, ...over });

  it("entrada 20/09 não cobra a 2ª quinzena duas vezes", () => {
    const t = q({});
    assert.deepEqual(dueIn(t, "2026-09"), ["2026-09-20 5867"]);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-10 8000", "2026-10-25 8000"]);
  });

  it("entrada 05/09 cobra o restante da 1ª quinzena e a 2ª cheia", () => {
    assert.deepEqual(dueIn(q({ startDate: "2026-09-05" }), "2026-09"), ["2026-09-05 5867", "2026-09-25 8000"]);
  });

  it("entrada no dia 16 é quinzena cheia", () => {
    assert.equal(firstCharge(q({ startDate: "2026-09-16" })).amountCents, 8000);
  });

  it("depois do uso paga cada quinzena no vencimento seguinte", () => {
    const t = q({ timing: "postpaid" });
    assert.deepEqual(dueIn(t, "2026-09"), []);
    assert.deepEqual(dueIn(t, "2026-10"), ["2026-10-10 5867", "2026-10-25 8000"]);
  });
});

describe("semanal: semanas reais", () => {
  const w = (over: Partial<MembershipTerms>): MembershipTerms =>
    monthly({ period: "weekly", priceCents: 4500, ...over });

  it("ciclos de 7 dias a partir da entrada, 4 ou 5 por mês", () => {
    const t = w({});
    assert.deepEqual(dueIn(t, "2026-09"), ["2026-09-20 4500", "2026-09-27 4500"]);
    assert.equal(chargesDueIn(t, "2026-10").length, 4);
    assert.equal(chargesDueIn(t, "2026-11").length, 5);
  });

  it("índice do ciclo dentro da competência", () => {
    const nov = chargesDueIn(w({}), "2026-11");
    assert.deepEqual(nov.map((c) => `${c.cycleIndex}/${c.cycleTotal}`), ["1/5", "2/5", "3/5", "4/5", "5/5"]);
  });

  it("depois do uso vence ao fim da semana", () => {
    assert.equal(firstCharge(w({ timing: "postpaid" })).dueDate, "2026-09-27");
  });
});

describe("desconto", () => {
  it("percentual e fixo, nunca negativo", () => {
    assert.equal(applyDiscount(15000, { type: "percentage", value: 10 }), 13500);
    assert.equal(applyDiscount(15000, { type: "fixed", value: 2000 }), 13000);
    assert.equal(applyDiscount(15000, { type: "fixed", value: 99999 }), 0);
    assert.equal(applyDiscount(15000, { type: "percentage", value: 150 }), 0);
  });

  it("proporcional sobre o valor com desconto", () => {
    assert.equal(firstCharge(monthly({ priceCents: 13500 })).amountCents, 4950);
  });
});
