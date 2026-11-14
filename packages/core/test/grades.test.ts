import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageGrades,
  averageOfAverages,
  averagesByLevel,
  conceptFromNumeric,
  defaultAssessmentSettings,
  defaultPassingGrade,
  formatAverage,
  formatGrade,
  gradeToNumeric,
  isBelowPassing,
  normalizeGrade,
  normalizePassingGrade,
  resultOf,
  roundHalfUp,
  validateMinAttendance,
  validatePoints,
  validateWeight,
  withRecovery,
  assessmentAverage,
  isGradeBelowPassing,
} from "../src/grades.ts";

const ten = defaultAssessmentSettings(true, "zero_ten");
const hundred = defaultAssessmentSettings(true, "zero_hundred");
const concept = defaultAssessmentSettings(true, "concept");
const passFail = defaultAssessmentSettings(true, "pass_fail");

const g = (value: number | string, weight = 1) => ({ status: "graded" as const, value: value as never, weight });

describe("notas: escalas e padrões", () => {
  it("nota mínima padrão por escala", () => {
    assert.equal(defaultPassingGrade("zero_ten"), 6);
    assert.equal(defaultPassingGrade("zero_hundred"), 60);
    assert.equal(defaultPassingGrade("concept"), "C");
    assert.equal(defaultPassingGrade("pass_fail"), "pass");
    assert.deepEqual(defaultAssessmentSettings(false), { enabled: false, scale: "zero_ten", passingGrade: 6 });
  });

  it("conceito vira número (A=10 ... E=2) e apto vira 1/0", () => {
    assert.deepEqual(["A", "B", "C", "D", "E"].map((c) => gradeToNumeric("concept", c as never)), [10, 8, 6, 4, 2]);
    assert.equal(gradeToNumeric("pass_fail", "pass"), 1);
    assert.equal(gradeToNumeric("pass_fail", "fail"), 0);
  });

  it("média de conceito volta para a letra mais próxima", () => {
    assert.equal(conceptFromNumeric(9), "A");
    assert.equal(conceptFromNumeric(8.9), "B");
    assert.equal(conceptFromNumeric(7), "B");
    assert.equal(conceptFromNumeric(5), "C");
    assert.equal(conceptFromNumeric(4.9), "D");
    assert.equal(conceptFromNumeric(2.9), "E");
  });
});

describe("notas: validação", () => {
  it("0 a 10 aceita vírgula e uma casa decimal", () => {
    assert.deepEqual(normalizeGrade("zero_ten", "7,5"), { ok: true, value: 7.5 });
    assert.deepEqual(normalizeGrade("zero_ten", 10), { ok: true, value: 10 });
    assert.deepEqual(normalizeGrade("zero_ten", "0"), { ok: true, value: 0 });
    assert.equal(normalizeGrade("zero_ten", "7,55").ok, false);
    assert.equal(normalizeGrade("zero_ten", 10.5).ok, false);
    assert.equal(normalizeGrade("zero_ten", -1).ok, false);
    assert.equal(normalizeGrade("zero_ten", "abc").ok, false);
    assert.equal(normalizeGrade("zero_ten", "").ok, false);
  });

  it("0 a 100 só inteiro", () => {
    assert.deepEqual(normalizeGrade("zero_hundred", "85"), { ok: true, value: 85 });
    assert.equal(normalizeGrade("zero_hundred", "85,5").ok, false);
    assert.equal(normalizeGrade("zero_hundred", 101).ok, false);
  });

  it("conceito A a E (aceita minúscula)", () => {
    assert.deepEqual(normalizeGrade("concept", "b"), { ok: true, value: "B" });
    assert.equal(normalizeGrade("concept", "F").ok, false);
    assert.equal(normalizeGrade("concept", 8).ok, false);
  });

  it("apto/não apto", () => {
    assert.deepEqual(normalizeGrade("pass_fail", "pass"), { ok: true, value: "pass" });
    assert.deepEqual(normalizeGrade("pass_fail", "Não apto"), { ok: true, value: "fail" });
    assert.equal(normalizeGrade("pass_fail", "talvez").ok, false);
    // A mínima do apto é sempre "apto".
    assert.deepEqual(normalizePassingGrade("pass_fail", "fail"), { ok: true, value: "pass" });
  });

  it("peso maior que zero, até 100, uma casa", () => {
    assert.deepEqual(validateWeight("1,5"), { ok: true, value: 1.5 });
    assert.equal(validateWeight(0).ok, false);
    assert.equal(validateWeight(101).ok, false);
    assert.equal(validateWeight("1,25").ok, false);
  });
});

describe("notas: abaixo da mínima", () => {
  it("compara na escala", () => {
    assert.equal(isBelowPassing("zero_ten", 5.9, 6), true);
    assert.equal(isBelowPassing("zero_ten", 6, 6), false);
    assert.equal(isBelowPassing("zero_hundred", 59, 60), true);
    assert.equal(isBelowPassing("concept", "D", "C"), true);
    assert.equal(isBelowPassing("concept", "C", "C"), false);
    assert.equal(isBelowPassing("pass_fail", "fail", "pass"), true);
    assert.equal(isBelowPassing("pass_fail", "pass", "pass"), false);
  });
});

describe("notas: média ponderada", () => {
  it("pondera pelo peso e arredonda para uma casa (metade para cima)", () => {
    // (5*1 + 8*2) / 3 = 7
    assert.equal(averageGrades(ten, [g(5), g(8, 2)])?.value, 7);
    // (6 + 6.5) / 2 = 6.25 -> 6.3
    assert.equal(averageGrades(ten, [g(6), g(6.5)])?.value, 6.3);
    assert.equal(roundHalfUp(6.25, 1), 6.3);
  });

  it("0 a 100 arredonda para inteiro", () => {
    const avg = averageGrades(hundred, [g(59), g(60)]);
    assert.equal(avg?.value, 60);
    assert.equal(avg?.belowPassing, false);
  });

  it("faltou e sem nota ficam fora; sem notas = null", () => {
    const avg = averageGrades(ten, [g(8), { status: "absent", weight: 1 }, { status: "none", weight: 1 }]);
    assert.equal(avg?.value, 8);
    assert.equal(avg?.count, 1);
    assert.equal(averageGrades(ten, [{ status: "absent", weight: 1 }]), null);
    assert.equal(averageGrades(ten, []), null);
  });

  it("marca média abaixo da mínima", () => {
    assert.equal(averageGrades(ten, [g(5), g(6)])?.belowPassing, true);
    assert.equal(averageGrades({ scale: "zero_ten", passingGrade: 5 }, [g(5), g(6)])?.belowPassing, false);
  });

  it("conceito: média numérica e volta para a letra", () => {
    // A(10) + C(6) = 8 -> B
    const avg = averageGrades(concept, [g("A"), g("C")]);
    assert.equal(avg?.numeric, 8);
    assert.equal(avg?.value, "B");
    assert.equal(avg?.belowPassing, false);
    // D(4) peso 3 + B(8) peso 1 = 5 -> C
    assert.equal(averageGrades(concept, [g("D", 3), g("B")])?.value, "C");
    assert.equal(averageGrades(concept, [g("D"), g("E")])?.belowPassing, true);
  });

  it("apto: fração de aptos e apto pela maioria", () => {
    const avg = averageGrades(passFail, [g("pass"), g("pass"), g("fail"), g("pass")]);
    assert.equal(avg?.numeric, 0.75);
    assert.equal(avg?.value, "pass");
    assert.equal(formatAverage("pass_fail", avg!), "75% aptos");
    const half = averageGrades(passFail, [g("pass"), g("fail")]);
    assert.equal(half?.value, "pass");
    const low = averageGrades(passFail, [g("pass"), g("fail", 2)]);
    assert.equal(low?.value, "fail");
    assert.equal(low?.belowPassing, true);
  });

  it("média da turma = média das médias dos alunos", () => {
    const a = averageGrades(ten, [g(8)]);
    const b = averageGrades(ten, [g(5)]);
    const avg = averageOfAverages(ten, [a, b, null]);
    assert.equal(avg?.value, 6.5);
    assert.equal(avg?.count, 2);
    assert.equal(averageOfAverages(concept, [averageGrades(concept, [g("A")]), averageGrades(concept, [g("E")])])?.value, "C");
    assert.equal(averageOfAverages(ten, [null]), null);
  });
});

describe("notas: médias por etapa", () => {
  it("segue a ordem da trilha e põe sem etapa no fim", () => {
    const rows = averagesByLevel(
      ten,
      [
        { ...g(9), levelId: "m2" },
        { ...g(7), levelId: "m1" },
        { ...g(5), levelId: "m1" },
        { ...g(4) },
        { ...g(10), levelId: "removida" },
      ],
      ["m1", "m2", "m3"],
    );
    assert.deepEqual(
      rows.map((r) => [r.levelId, r.average?.value]),
      [
        ["m1", 6],
        ["m2", 9],
        [undefined, 7],
      ],
    );
  });
});

describe("notas: exibição", () => {
  it("formata em pt-BR", () => {
    assert.equal(formatGrade("zero_ten", 7.5), "7,5");
    assert.equal(formatGrade("zero_ten", 8), "8");
    assert.equal(formatGrade("zero_hundred", 85), "85");
    assert.equal(formatGrade("concept", "B"), "B");
    assert.equal(formatGrade("pass_fail", "fail"), "Não apto");
  });
});

describe("soma dos pontos, recuperação e frequência mínima (fase A, 31/10/2026)", () => {
  const sumTen = { ...ten, resultMode: "sum" as const };
  const p = (value: number, points: number) => ({ status: "graded" as const, value, weight: 1, points });

  it("nota vai de 0 ao que a avaliação vale", () => {
    assert.deepEqual(normalizeGrade("zero_ten", "2,5", 3), { ok: true, value: 2.5 });
    assert.deepEqual(normalizeGrade("zero_ten", "3,5", 3), { ok: false, message: "A nota vai de 0 a 3." });
    assert.deepEqual(normalizeGrade("zero_hundred", "35", 30), { ok: false, message: "A nota vai de 0 a 30." });
  });

  it("quanto a avaliação vale: até o topo da escala", () => {
    assert.deepEqual(validatePoints("zero_ten", "2,5"), { ok: true, value: 2.5 });
    assert.equal(validatePoints("zero_ten", "11").ok, false);
    assert.equal(validatePoints("zero_hundred", "30,5").ok, false);
    assert.equal(validatePoints("zero_ten", "0").ok, false);
  });

  it("total é a soma, até o topo; o vermelho segue o ritmo dos pontos dados", () => {
    // 3 de 3: total 3, sem vermelho, embora a mínima final seja 6.
    const first = resultOf(sumTen, [p(3, 3)]);
    assert.deepEqual(first, { value: 3, numeric: 3, count: 1, belowPassing: false, outOf: 3 });
    // 3 + 1 de 3 + 3: total 4 de 6 dados (66%) fica acima da mínima de 60%.
    assert.equal(resultOf(sumTen, [p(3, 3), p(1, 3)])?.belowPassing, false);
    // 3 + 0,5 de 6 dados (58%): abaixo.
    assert.equal(resultOf(sumTen, [p(3, 3), p(0.5, 3)])?.belowPassing, true);
    // Faltou conta nos pontos dados.
    const absent = resultOf(sumTen, [p(3, 3), { status: "absent", weight: 1, points: 4 }]);
    assert.equal(absent?.outOf, 7);
    assert.equal(absent?.belowPassing, true);
    // Ponto extra nao passa do topo.
    assert.equal(resultOf(sumTen, [p(6, 6), p(5, 5)])?.value, 10);
  });

  it("média da turma na soma: total médio pelo ritmo médio", () => {
    const a = resultOf(sumTen, [p(3, 3)]);
    const b = resultOf(sumTen, [p(1, 3)]);
    assert.deepEqual(averageOfAverages(sumTen, [a, b]), { value: 2, numeric: 2, count: 2, belowPassing: false, outOf: 3 });
  });

  it("período fechado na soma: o total contra o mínimo, não o ritmo (13/11/2026)", () => {
    // 4 de 6 pontos dados, mínimo 6 de 10: no meio do período segue o ritmo (66%); fechado, fica abaixo.
    const items = [p(3, 3), p(1, 3)];
    assert.equal(resultOf(sumTen, items)?.belowPassing, false);
    assert.equal(resultOf(sumTen, items, { closed: true })?.belowPassing, true);
    assert.equal(resultOf(sumTen, [p(3, 3), p(3, 3), p(2, 4)], { closed: true })?.belowPassing, false);
    // Média da turma: o total médio contra o mínimo.
    const a = resultOf(sumTen, [p(3, 3)]);
    const b = resultOf(sumTen, [p(1, 3)]);
    assert.equal(averageOfAverages(sumTen, [a, b], { closed: true })?.belowPassing, true);
    // Por etapa: só a etapa passada fecha.
    const rows = averagesByLevel(
      sumTen,
      [{ ...p(4, 6), levelId: "l1" }, { ...p(4, 6), levelId: "l2" }],
      ["l1", "l2"],
      new Set(["l1"]),
    );
    assert.deepEqual(rows.map((r) => [r.levelId, r.average?.belowPassing]), [["l1", true], ["l2", false]]);
    // Fora da soma, fechar não muda nada.
    assert.equal(resultOf(ten, [g(7)], { closed: true })?.belowPassing, false);
  });

  it("avaliação na soma: vermelho proporcional ao que ela vale", () => {
    assert.equal(isGradeBelowPassing(sumTen, 2, 3), false);
    assert.equal(isGradeBelowPassing(sumTen, 1.5, 3), true);
    assert.equal(assessmentAverage(sumTen, [g(2), g(1)], 3)?.belowPassing, true);
    // Fora da soma, a regra de sempre.
    assert.equal(isGradeBelowPassing(ten, 2, 3), true);
  });

  it("média com pesos continua igual com o modo padrão", () => {
    assert.deepEqual(resultOf(ten, [g(5, 1), g(8, 2)]), averageGrades(ten, [g(5, 1), g(8, 2)]));
  });

  it("recuperação: vale a maior; sem nota na original, vale a recuperação", () => {
    assert.deepEqual(withRecovery("zero_ten", { status: "graded", value: 4 }, { status: "graded", value: 7 }), {
      status: "graded",
      value: 7,
      recovered: true,
    });
    assert.deepEqual(withRecovery("zero_ten", { status: "graded", value: 8 }, { status: "graded", value: 7 }), {
      status: "graded",
      value: 8,
      recovered: false,
    });
    assert.deepEqual(withRecovery("concept", { status: "absent" }, { status: "graded", value: "C" }), {
      status: "graded",
      value: "C",
      recovered: true,
    });
    assert.equal(withRecovery("pass_fail", { status: "graded", value: "fail" }, { status: "graded", value: "pass" }).value, "pass");
    assert.equal(withRecovery("zero_ten", { status: "graded", value: 4 }, { status: "absent" }).value, 4);
  });

  it("frequência mínima: inteiro de 1 a 100", () => {
    assert.deepEqual(validateMinAttendance("75"), { ok: true, value: 75 });
    assert.equal(validateMinAttendance("0").ok, false);
    assert.equal(validateMinAttendance("75,5").ok, false);
    assert.equal(validateMinAttendance("101").ok, false);
  });
});

describe("arredondamento sem erro de ponto flutuante (achado V4, 31/10/2026)", () => {
  it("5,95 vira 6,0 e não reprova com mínima 6", () => {
    const avg = averageGrades(ten, [g(2.2), g(9.7)]);
    assert.equal(avg?.value, 6);
    assert.equal(avg?.belowPassing, false);
    assert.equal(roundHalfUp(5.95, 1), 6);
    assert.equal(roundHalfUp(4.5), 5);
  });
});
