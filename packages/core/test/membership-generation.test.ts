import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Charge, ClassGroup, Client, Enrollment, Plan } from "@gestarahub/contracts";
import {
  membershipCompetencesToGenerate,
  planMembershipCharges,
  type MembershipWorld,
} from "../src/membership-generation.ts";

const plan: Plan = {
  id: "plan-1",
  organizationId: "org",
  name: "Mensal",
  period: "monthly",
  priceCents: 10000,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Plan;

function student(id: string, extra: Partial<Client> = {}): Client {
  return {
    id,
    organizationId: "org",
    name: id,
    phone: "+5511999999999",
    status: "active",
    planId: "plan-1",
    planStartDate: "2026-09-01",
    dueDay: 10,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...extra,
  } as Client;
}

function world(extra: Partial<MembershipWorld> = {}): MembershipWorld {
  return {
    clients: [student("ana")],
    plans: [plan],
    classGroups: [],
    enrollments: [],
    charges: [],
    settings: { billingTiming: "prepaid", midMonthStrategy: "prorated", defaultDueDay: 10 },
    today: "2026-10-21",
    ...extra,
  };
}

describe("mensalidades automáticas (planejamento puro, doc 15 fatia 1)", () => {
  it("competências: desde a vigência mais antiga até o mês atual, mais as pedidas que já chegaram", () => {
    assert.deepEqual(membershipCompetencesToGenerate(world(), ["2026-12"]), ["2026-09", "2026-10"]);
    assert.deepEqual(membershipCompetencesToGenerate(world(), ["2026-08"]), ["2026-08", "2026-09", "2026-10"]);
  });

  it("gera uma mensalidade por competência e é idempotente com as existentes", () => {
    const w = world();
    const first = planMembershipCharges(w, ["2026-09", "2026-10"]);
    assert.equal(first.length, 2);
    assert.ok(first.every((c) => c.kind === "membership" && c.studentId === "ana" && c.planId === "plan-1"));

    const existing = first.map((c, i) => ({ ...c, id: `c${i}`, organizationId: "org", createdAt: "", updatedAt: "" })) as Charge[];
    assert.equal(planMembershipCharges({ ...w, charges: existing }, ["2026-09", "2026-10"]).length, 0);
  });

  it("não repete o mesmo período dentro da mesma chamada", () => {
    const planned = planMembershipCharges(world(), ["2026-10", "2026-10"]);
    assert.equal(planned.length, 1);
  });

  it("cancelada pelo sistema libera o período; cancelada pelo usuário no mesmo plano não", () => {
    const [base] = planMembershipCharges(world(), ["2026-10"]);
    const asCharge = (over: Partial<Charge>) =>
      ({ ...base, id: "x", organizationId: "org", createdAt: "", updatedAt: "", ...over }) as Charge;
    assert.equal(
      planMembershipCharges(world({ charges: [asCharge({ status: "canceled", canceledBy: "system" })] }), ["2026-10"]).length,
      1,
    );
    assert.equal(
      planMembershipCharges(world({ charges: [asCharge({ status: "canceled", canceledBy: "user" })] }), ["2026-10"]).length,
      0,
    );
  });

  it("inativo, pausado e sem plano não geram; bolsista integral sem plano gera isenta", () => {
    const w = world({
      clients: [
        student("inativo", { status: "inactive" }),
        student("pausado", { membershipStatus: "paused" }),
        student("semplano", { planId: undefined }),
        student("bolsista", { planId: undefined, discount: { type: "percentage", value: 100, scholarship: true } }),
      ],
    });
    const planned = planMembershipCharges(w, ["2026-10"]);
    assert.deepEqual(
      planned.map((c) => [c.studentId, c.status, c.scholarshipPercent]),
      [["bolsista", "waived", 100]],
    );
  });

  it("legado: sem plano próprio, matriculado em turma com plano, gera pelo plano da turma; pacote não", () => {
    const turma = { id: "t1", planId: "plan-1", billingMode: "membership" } as ClassGroup;
    const enroll = (id: string, studentId: string, paysWithPackage = false) =>
      ({ id, classGroupId: "t1", studentId, status: "active", paysWithPackage }) as Enrollment;
    const w = world({
      clients: [student("leg", { planId: undefined }), student("pac", { planId: undefined })],
      classGroups: [turma],
      enrollments: [enroll("e1", "leg"), enroll("e2", "pac", true)],
    });
    const planned = planMembershipCharges(w, ["2026-10"]);
    assert.deepEqual(
      planned.map((c) => [c.studentId, c.classGroupId]),
      [["leg", "t1"]],
    );
  });
});
