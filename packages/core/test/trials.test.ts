import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRIAL_FOLLOW_UP_DAYS, needsTrialFollowUp, trialOutcome } from "../src/trials.ts";

const today = "2026-11-20";
const none = { enrollments: [], packages: [] };

describe("aula experimental e conversao", () => {
  it("sem experimental: nada", () => {
    assert.deepEqual(trialOutcome({ ...none, trialDates: [] }, today), { stage: "none", trialCount: 0 });
  });

  it("experimental sem voltar: conta as aulas e os dias desde a ultima feita", () => {
    const out = trialOutcome({ ...none, trialDates: ["2026-11-09T10:00", "2026-11-11", "2026-11-25"] }, today);
    assert.equal(out.stage, "trial");
    assert.equal(out.trialCount, 3);
    assert.equal(out.firstTrialAt, "2026-11-09");
    assert.equal(out.lastTrialAt, "2026-11-11");
    assert.equal(out.daysSinceTrial, 9);
    assert.equal(needsTrialFollowUp(out), true);
  });

  it("experimental recente ainda nao pede follow-up", () => {
    const out = trialOutcome({ ...none, trialDates: ["2026-11-15"] }, today);
    assert.equal(out.daysSinceTrial, 5);
    assert.ok(out.daysSinceTrial! < TRIAL_FOLLOW_UP_DAYS);
    assert.equal(needsTrialFollowUp(out), false);
  });

  it("matricula, plano ou pacote depois da experimental converte; a primeira vale", () => {
    const out = trialOutcome(
      {
        trialDates: ["2026-11-09"],
        enrollments: [{ enrolledAt: "2026-11-16T14:00:00.000Z" }],
        packages: [{ purchasedAt: "2026-11-12" }],
      },
      today,
    );
    assert.equal(out.stage, "converted");
    assert.equal(out.convertedAt, "2026-11-12");
    assert.equal(out.convertedBy, "package");
    assert.equal(out.daysToConvert, 3);
    assert.equal(needsTrialFollowUp(out), false);

    const plan = trialOutcome({ ...none, trialDates: ["2026-11-09"], planStartDate: "2026-11-09" }, today);
    assert.equal(plan.stage, "converted");
    assert.equal(plan.convertedBy, "plan");
    assert.equal(plan.daysToConvert, 0);
  });

  it("quem ja era aluno antes da experimental nao e experimental", () => {
    const out = trialOutcome(
      { ...none, trialDates: ["2026-11-09"], enrollments: [{ enrolledAt: "2026-03-01T12:00:00.000Z" }] },
      today,
    );
    assert.equal(out.stage, "none");
  });
});
