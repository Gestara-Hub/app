import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeCharge, splitInstallments } from "../src/billing.ts";

const brief = (list: ReturnType<typeof splitInstallments>) =>
  list.map((i) => `${i.index}/${i.total} ${i.dueDate} ${i.amountCents}`);

describe("cobrança avulsa: divisão em parcelas", () => {
  it("à vista: uma parcela com o valor inteiro", () => {
    assert.deepEqual(brief(splitInstallments(25000, 1, "2026-09-22")), ["1/1 2026-09-22 25000"]);
  });

  it("o resto dos centavos vai para a primeira parcela", () => {
    assert.deepEqual(brief(splitInstallments(10000, 3, "2026-10-10")), [
      "1/3 2026-10-10 3334",
      "2/3 2026-11-10 3333",
      "3/3 2026-12-10 3333",
    ]);
    const twelve = splitInstallments(100001, 12, "2026-01-05");
    assert.equal(twelve[0].amountCents, 8333 + 5);
    assert.ok(twelve.slice(1).every((i) => i.amountCents === 8333));
  });

  it("a soma das parcelas é sempre o total", () => {
    for (const total of [1, 99, 10000, 12345, 999999]) {
      for (let n = 1; n <= 12; n++) {
        const sum = splitInstallments(total, n, "2026-09-22").reduce((s, i) => s + i.amountCents, 0);
        assert.equal(sum, total, `${total} em ${n}x`);
      }
    }
  });

  it("valor menor que o número de parcelas: parcelas de zero no fim", () => {
    assert.deepEqual(
      splitInstallments(2, 3, "2026-09-22").map((i) => i.amountCents),
      [2, 0, 0],
    );
  });

  it("vira o ano mantendo o dia", () => {
    assert.deepEqual(
      splitInstallments(30000, 3, "2026-11-15").map((i) => i.dueDate),
      ["2026-11-15", "2026-12-15", "2027-01-15"],
    );
  });

  it("dia 31 cai no último dia dos meses curtos e volta para 31", () => {
    assert.deepEqual(
      splitInstallments(40000, 4, "2027-01-31").map((i) => i.dueDate),
      ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"],
    );
    // Ano bissexto: 29/02.
    assert.deepEqual(
      splitInstallments(30000, 3, "2028-01-31").map((i) => i.dueDate),
      ["2028-01-31", "2028-02-29", "2028-03-31"],
    );
  });

  it("29/02 como primeiro vencimento: o dia 29 segue nos meses seguintes", () => {
    assert.deepEqual(
      splitInstallments(20000, 2, "2028-02-29").map((i) => i.dueDate),
      ["2028-02-29", "2028-03-29"],
    );
  });

  it("aceita de 1 a 12 parcelas", () => {
    for (const bad of [0, 13, -1, 1.5, Number.NaN]) {
      assert.throws(() => splitInstallments(10000, bad, "2026-09-22"), RangeError, String(bad));
    }
    assert.throws(() => splitInstallments(-1, 1, "2026-09-22"), RangeError);
    assert.throws(() => splitInstallments(100, 1, "data"), RangeError);
  });
});

describe("rótulo da cobrança (auditoria)", () => {
  it("mensalidade, aula avulsa e cobrança avulsa", () => {
    assert.equal(describeCharge({ kind: "membership" }, "Ana"), "mensalidade de Ana");
    assert.equal(describeCharge({ kind: "dropin" }, "Ana"), "aula avulsa de Ana");
    assert.equal(
      describeCharge({ kind: "extra", description: "Kimono", cycleIndex: 1, cycleTotal: 1 }, "Ana"),
      'cobrança avulsa "Kimono" de Ana',
    );
    assert.equal(
      describeCharge({ kind: "extra", description: "Kimono", cycleIndex: 2, cycleTotal: 3 }, "Ana"),
      'parcela 2 de 3 da cobrança avulsa "Kimono" de Ana',
    );
  });
});
