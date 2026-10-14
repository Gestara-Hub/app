import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classBillingMode,
  describeCharge,
  hasEnded,
  isCourseEnded,
  isFutureOpenInstallment,
} from "../src/billing.ts";

describe("curso fechado: forma de cobrança da turma", () => {
  it("ausente é mensalidade (turmas de antes)", () => {
    assert.equal(classBillingMode({}), "membership");
    assert.equal(classBillingMode({ billingMode: "course" }), "course");
    assert.equal(classBillingMode({ billingMode: "free" }), "free");
  });

  it("terminou só quando a data de fim ficou antes de hoje", () => {
    assert.equal(hasEnded({}, "2026-09-22"), false);
    assert.equal(hasEnded({ endDate: "2026-09-22" }, "2026-09-22"), false);
    assert.equal(hasEnded({ endDate: "2026-09-21" }, "2026-09-22"), true);
  });

  it("curso encerrado: só curso com fim no passado", () => {
    assert.equal(isCourseEnded({ billingMode: "course", endDate: "2026-09-21" }, "2026-09-22"), true);
    assert.equal(isCourseEnded({ billingMode: "course", endDate: "2026-09-22" }, "2026-09-22"), false);
    assert.equal(isCourseEnded({ billingMode: "membership", endDate: "2026-09-21" }, "2026-09-22"), false);
    assert.equal(isCourseEnded({ endDate: "2026-09-21" }, "2026-09-22"), false);
  });
});

describe("curso fechado: parcelas canceladas na saída do aluno", () => {
  const today = "2026-09-22";
  it("só as em aberto que vencem depois de hoje", () => {
    assert.equal(isFutureOpenInstallment({ status: "pending", dueDate: "2026-10-22" }, today), true);
    assert.equal(isFutureOpenInstallment({ status: "overdue", dueDate: "2026-10-22" }, today), true);
    // Vence hoje ou já venceu: continua como dívida.
    assert.equal(isFutureOpenInstallment({ status: "pending", dueDate: today }, today), false);
    assert.equal(isFutureOpenInstallment({ status: "overdue", dueDate: "2026-09-01" }, today), false);
    // Paga, cancelada ou isenta: fica como está.
    assert.equal(isFutureOpenInstallment({ status: "paid", dueDate: "2026-10-22" }, today), false);
    assert.equal(isFutureOpenInstallment({ status: "canceled", dueDate: "2026-10-22" }, today), false);
    assert.equal(isFutureOpenInstallment({ status: "waived", dueDate: "2026-10-22" }, today), false);
  });
});

describe("rótulo da parcela do curso (auditoria)", () => {
  it("à vista e parcelado", () => {
    assert.equal(
      describeCharge({ kind: "course", description: "Confeitaria", cycleIndex: 1, cycleTotal: 1 }, "Ana"),
      'curso "Confeitaria" de Ana',
    );
    assert.equal(
      describeCharge({ kind: "course", description: "Confeitaria", cycleIndex: 2, cycleTotal: 4 }, "Ana"),
      'parcela 2 de 4 do curso "Confeitaria" de Ana',
    );
  });
});
