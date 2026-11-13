import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StudentStageGrades } from "@gestarahub/contracts";
import { defaultAssessmentSettings, resultOf } from "../src/grades.ts";
import { promotionReadiness, stageGradeChecks, type PromotionReadinessInput } from "../src/progression.ts";

/** "Apto" com notas (doc product/30 §1). */
const base: PromotionReadinessInput = {
  criteriaType: "attendance",
  targetAttendances: 30,
  targetMonths: 6,
  presentSincePromotion: 30,
  monthsInLevel: 0,
  hasNextStep: true,
  inLevel: "neste nível",
};

const ten = { ...defaultAssessmentSettings(true, "zero_ten"), passingGrade: 6 };

function stage(values: number[], extra: Partial<StudentStageGrades> = {}): StudentStageGrades {
  const settings = extra.settings ?? ten;
  const average = resultOf(
    settings,
    values.map((value) => ({ status: "graded" as const, value, weight: 1 })),
  );
  return { settings, average, attendancePercent: null, ...extra };
}

describe("promotionReadiness: criterio da trilha", () => {
  it("presenca: apto ao bater a meta; antes, diz quantas aulas faltam", () => {
    assert.deepEqual(promotionReadiness(base), { ready: true, gaps: [] });
    assert.deepEqual(promotionReadiness({ ...base, presentSincePromotion: 24 }), {
      ready: false,
      gaps: ["Faltam 6 aulas"],
    });
    assert.deepEqual(promotionReadiness({ ...base, presentSincePromotion: 29 }).gaps, ["Falta 1 aula"]);
  });

  it("presenca e tempo: os dois precisam bater", () => {
    const input = { ...base, criteriaType: "attendance_and_time" as const, monthsInLevel: 4 };
    assert.deepEqual(promotionReadiness(input), { ready: false, gaps: ["Faltam 2 meses"] });
    assert.equal(promotionReadiness({ ...input, monthsInLevel: 6 }).ready, true);
    assert.deepEqual(promotionReadiness({ ...input, criteriaType: "time", monthsInLevel: 5 }).gaps, ["Falta 1 mês"]);
  });

  it("ultimo nivel da trilha nunca fica apto", () => {
    assert.equal(promotionReadiness({ ...base, hasNextStep: false }).ready, false);
  });

  it("por prova sem notas no sistema: o professor decide, sem selo", () => {
    assert.deepEqual(promotionReadiness({ ...base, criteriaType: "manual_exam", presentSincePromotion: 0 }), {
      ready: false,
      gaps: [],
    });
  });
});

describe("promotionReadiness: com notas", () => {
  it("media da etapa na minima: apto; abaixo, diz a media e a minima", () => {
    assert.equal(promotionReadiness({ ...base, grades: stage([7, 8]) }).ready, true);
    assert.deepEqual(promotionReadiness({ ...base, grades: stage([5, 6.6]) }), {
      ready: false,
      gaps: ["Média 5,8, mínima 6"],
    });
  });

  it("sem nota na etapa nao fica apto", () => {
    assert.deepEqual(promotionReadiness({ ...base, grades: stage([]) }), {
      ready: false,
      gaps: ["Sem nota neste nível"],
    });
    assert.deepEqual(promotionReadiness({ ...base, inLevel: undefined, grades: stage([]) }).gaps, [
      "Sem nota nesta etapa",
    ]);
  });

  it("frequencia minima: abaixo reprova; sem chamada nao", () => {
    const settings = { ...ten, minAttendancePercent: 75 };
    assert.deepEqual(
      promotionReadiness({ ...base, grades: stage([8], { settings, attendancePercent: 68 }) }).gaps,
      ["Frequência 68%, mínima 75%"],
    );
    assert.equal(promotionReadiness({ ...base, grades: stage([8], { settings, attendancePercent: 80 }) }).ready, true);
    assert.equal(promotionReadiness({ ...base, grades: stage([8], { settings, attendancePercent: null }) }).ready, true);
  });

  it("junta o que falta da trilha e das notas", () => {
    assert.deepEqual(promotionReadiness({ ...base, presentSincePromotion: 20, grades: stage([4]) }).gaps, [
      "Faltam 10 aulas",
      "Média 4, mínima 6",
    ]);
  });

  it("por prova com notas: valem so as notas", () => {
    const exam = { ...base, criteriaType: "manual_exam" as const, presentSincePromotion: 0 };
    assert.equal(promotionReadiness({ ...exam, grades: stage([9]) }).ready, true);
    assert.equal(promotionReadiness({ ...exam, grades: stage([3]) }).ready, false);
  });
});

describe("stageGradeChecks", () => {
  it("media com a minima e frequencia com a minima", () => {
    const settings = { ...ten, minAttendancePercent: 75 };
    assert.deepEqual(stageGradeChecks(stage([7.5], { settings, attendancePercent: 90 })), [
      { key: "grade", label: "Média", value: "7,5", target: "mínima 6", ok: true },
      { key: "attendance", label: "Frequência", value: "90%", target: "mínima 75%", ok: true },
    ]);
  });

  it("soma dos pontos mostra o total sobre os pontos dados", () => {
    const settings = { ...ten, resultMode: "sum" as const };
    const average = resultOf(settings, [
      { status: "graded", value: 2, weight: 1, points: 3 },
      { status: "graded", value: 1, weight: 1, points: 3 },
    ]);
    const [check] = stageGradeChecks({ settings, average, attendancePercent: null });
    assert.deepEqual(check, { key: "grade", label: "Total", value: "3 de 6", target: "mínimo 6 de 10", ok: false });
  });

  it("conceito e apto ou nao", () => {
    const concept = defaultAssessmentSettings(true, "concept");
    const [c] = stageGradeChecks({
      settings: concept,
      average: resultOf(concept, [{ status: "graded", value: "B", weight: 1 }]),
      attendancePercent: null,
    });
    assert.deepEqual(c, { key: "grade", label: "Média", value: "B", target: "mínima C", ok: true });

    const passFail = defaultAssessmentSettings(true, "pass_fail");
    const [p] = stageGradeChecks({
      settings: passFail,
      average: resultOf(passFail, [{ status: "graded", value: "fail", weight: 1 }]),
      attendancePercent: null,
    });
    assert.deepEqual(p, { key: "grade", label: "Avaliações", value: "Não apto", ok: false });
  });
});
