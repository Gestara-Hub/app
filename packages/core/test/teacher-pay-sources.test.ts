import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PackageUsage, TeacherPayComponent } from "@gestarahub/contracts";
import {
  computeTeacherPayout,
  payoutTotalCents,
  type TeacherPayClassGroup,
  type TeacherPayCourseInstallment,
  type TeacherPayFacts,
  type TeacherPayPackageLesson,
} from "../src/finance.ts";
import {
  carriedLots,
  isPackageFullyPaid,
  leftoverLots,
  lessonOriginAt,
  lessonOrigins,
  ownLessons,
  packagePriceCents,
  packageUnitValueCents,
  valuePackageLessons,
  type PackageForValue,
} from "../src/packages.ts";

/**
 * Repasse do professor, decisao 7 do doc 20: "% do que os alunos pagaram"
 * soma mensalidades (como antes), parcelas de curso pagas (titular da turma
 * do curso) e aulas de pacote dadas (quem deu a aula, pelo valor de cada aula).
 */

const plain = (text: string) => text.replace(/\s/g, " ");
const COMP = "2026-10";

const rule = (components: TeacherPayComponent[]) => ({
  components,
  status: "active" as const,
  startCompetence: "2026-01",
});

const groups: TeacherPayClassGroup[] = [
  { id: "mens", instructorId: "t1" },
  { id: "curso", instructorId: "t1", billingMode: "course" },
  { id: "curso2", instructorId: "t1", billingMode: "course" },
  { id: "pac", instructorId: "t1", billingMode: "package" },
  { id: "outro", instructorId: "t2", billingMode: "course" },
];

const facts = (over: Partial<TeacherPayFacts> = {}): TeacherPayFacts => ({
  professionalId: "t1",
  classGroups: groups,
  sessionsDone: [],
  activeEnrollments: [],
  paidMemberships: [],
  ...over,
});

const installment = (chargeId: string, classGroupId: string, amountCents: number): TeacherPayCourseInstallment => ({
  chargeId,
  studentId: `s-${chargeId}`,
  classGroupId,
  amountCents,
});

const lesson = (n: number, classGroupId: string, instructorId: string, valueCents: number): TeacherPayPackageLesson => ({
  sessionId: `${classGroupId}~${COMP}-0${n}~08:00`,
  studentId: "a1",
  classGroupId,
  date: `${COMP}-0${n}`,
  instructorId,
  valueCents,
});

const percent = (value: number, classGroupIds?: string[]): TeacherPayComponent => ({
  kind: "percent_of_memberships",
  percent: value,
  ...(classGroupIds ? { classGroupIds } : {}),
});

describe("% do que os alunos pagaram: fontes", () => {
  it("uma linha por fonte com valor (mensalidades, cursos, pacotes)", () => {
    const f = facts({
      activeEnrollments: [{ studentId: "a1", classGroupId: "mens" }],
      paidMemberships: [{ chargeId: "m1", studentId: "a1", amountCents: 20000 }],
      paidCourseInstallments: [installment("c1", "curso", 40000), installment("c2", "outro", 99900)],
      packageLessons: [lesson(1, "pac", "t1", 5000), lesson(2, "pac", "t1", 5000), lesson(3, "pac", "t2", 5000)],
    });
    const lines = computeTeacherPayout(rule([percent(30)]), f, COMP);
    assert.deepEqual(
      lines.map((l) => ({ source: l.source, label: plain(l.label), baseCents: l.baseCents, quantity: l.quantity, amountCents: l.amountCents })),
      [
        { source: "memberships", label: "30% de R$ 200,00 em mensalidades", baseCents: 20000, quantity: undefined, amountCents: 6000 },
        { source: "courses", label: "30% de R$ 400,00 em cursos", baseCents: 40000, quantity: undefined, amountCents: 12000 },
        { source: "packages", label: "30% de R$ 100,00 em pacotes (2 aulas)", baseCents: 10000, quantity: 2, amountCents: 3000 },
      ],
    );
    assert.equal(payoutTotalCents(lines), 21000);
  });

  it("sem nada pago fica uma linha zerada, sem fonte", () => {
    const lines = computeTeacherPayout(rule([percent(40)]), facts(), COMP);
    assert.deepEqual(
      lines.map((l) => ({ ...l, label: plain(l.label) })),
      [{ kind: "percent_of_memberships", label: "40% de R$ 0,00", baseCents: 0, amountCents: 0 }],
    );
  });

  it("curso: a parcela paga vai inteira para o titular da turma do curso", () => {
    const f = facts({ paidCourseInstallments: [installment("c1", "outro", 30000)] });
    assert.deepEqual(computeTeacherPayout(rule([percent(50)]), f, COMP).map((l) => l.amountCents), [0]);
    const other = computeTeacherPayout(rule([percent(50)]), { ...f, professionalId: "t2" }, COMP);
    assert.deepEqual(other.map((l) => [l.source, l.amountCents]), [["courses", 15000]]);
  });

  it("pacote: a aula conta para quem deu a aula (substituto recebe a dele)", () => {
    // Turma "pac" e do t1, mas a aula 2 foi dada pelo t2.
    const f = facts({ packageLessons: [lesson(1, "pac", "t1", 4000), lesson(2, "pac", "t2", 4000)] });
    const titular = computeTeacherPayout(rule([percent(50)]), f, COMP);
    const substitute = computeTeacherPayout(rule([percent(50)]), { ...f, professionalId: "t2" }, COMP);
    assert.deepEqual(titular.map((l) => [l.quantity, l.amountCents]), [[1, 2000]]);
    assert.deepEqual(substitute.map((l) => [l.quantity, l.amountCents]), [[1, 2000]]);
  });

  it("classGroupIds restringe cursos e pacotes às turmas listadas", () => {
    const f = facts({
      paidCourseInstallments: [installment("c1", "curso", 10000), installment("c2", "curso2", 20000)],
      packageLessons: [lesson(1, "pac", "t1", 3000), lesson(2, "mens", "t1", 3000)],
    });
    const lines = computeTeacherPayout(rule([percent(100, ["curso", "pac"])]), f, COMP);
    assert.deepEqual(
      lines.map((l) => [l.source, l.baseCents]),
      [
        ["courses", 10000],
        ["packages", 3000],
      ],
    );
  });

  it("cada linha arredonda para baixo; a sobra fica com o espaço (como o D4)", () => {
    const f = facts({
      paidCourseInstallments: [installment("c1", "curso", 999)],
      packageLessons: [lesson(1, "pac", "t1", 333)],
    });
    const lines = computeTeacherPayout(rule([percent(33)]), f, COMP);
    // 329,67 -> 329 e 109,89 -> 109
    assert.deepEqual(lines.map((l) => l.amountCents), [329, 109]);
  });

  it("mensalidade não é dividida com o professor de turma de curso ou de pacote", () => {
    const f = facts({
      professionalId: "t2",
      classGroups: [
        { id: "mens", instructorId: "t1" },
        { id: "curso-t2", instructorId: "t2", billingMode: "course" },
        { id: "pac-t2", instructorId: "t2", billingMode: "package" },
      ],
      activeEnrollments: [
        { studentId: "a1", classGroupId: "mens" },
        { studentId: "a1", classGroupId: "curso-t2" },
        { studentId: "a1", classGroupId: "pac-t2" },
      ],
      paidMemberships: [{ chargeId: "m1", studentId: "a1", amountCents: 20000 }],
    });
    assert.deepEqual(computeTeacherPayout(rule([percent(50)]), f, COMP).map((l) => l.amountCents), [0]);
    const t1 = computeTeacherPayout(rule([percent(50)]), { ...f, professionalId: "t1" }, COMP);
    assert.deepEqual(t1.map((l) => [l.source, l.baseCents]), [["memberships", 20000]]);
  });

  it("aluno só em turma de curso: a mensalidade vai para essa turma, como antes", () => {
    const f = facts({
      activeEnrollments: [{ studentId: "a1", classGroupId: "curso" }],
      paidMemberships: [{ chargeId: "m1", studentId: "a1", amountCents: 20000 }],
      paidCourseInstallments: [installment("c1", "curso", 80000)],
    });
    const lines = computeTeacherPayout(rule([percent(40)]), f, COMP);
    assert.deepEqual(
      lines.map((l) => [l.source, l.baseCents, l.amountCents]),
      [
        ["memberships", 20000, 8000],
        ["courses", 80000, 32000],
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// Valor de cada aula do pacote
// ---------------------------------------------------------------------------

const use = (date: string, n = 0): PackageUsage => ({
  sessionId: `g~${date}~0${n}`,
  classGroupId: "g",
  date,
  reason: "present",
});

const paid = (amountCents: number) => ({ status: "paid" as const, amountCents });
const pending = (amountCents: number) => ({ status: "pending" as const, amountCents });

function pkg(over: Partial<PackageForValue> & { id: string }): PackageForValue {
  return { studentId: "a1", lessonsTotal: 10, usages: [], charges: [paid(50000)], ...over };
}

describe("valor da aula do pacote", () => {
  it("preço ÷ aulas compradas, para baixo; cancelada não entra no preço", () => {
    assert.equal(packageUnitValueCents(50000, 10), 5000);
    assert.equal(packageUnitValueCents(10000, 3), 3333);
    assert.equal(packageUnitValueCents(10000, 0), 0);
    assert.equal(packagePriceCents([paid(30000), { status: "canceled", amountCents: 20000 }]), 30000);
    assert.equal(ownLessons({ lessonsTotal: 13, carriedOverLessons: 3 }), 10);
  });

  it("pago por inteiro: todas as cobranças que valem pagas (parcial ou sem cobrança não)", () => {
    assert.equal(isPackageFullyPaid([paid(25000), paid(25000)]), true);
    assert.equal(isPackageFullyPaid([paid(25000), pending(25000)]), false);
    assert.equal(isPackageFullyPaid([paid(25000), { status: "canceled", amountCents: 25000 }]), true);
    assert.equal(isPackageFullyPaid([{ status: "canceled", amountCents: 25000 }]), false);
    assert.equal(isPackageFullyPaid([]), false);
  });

  it("cada aula usada vale o preço ÷ aulas e sai marcada como paga ou não", () => {
    const out = valuePackageLessons([
      pkg({ id: "p1", usages: [use("2026-10-05"), use("2026-10-01")] }),
      pkg({ id: "p2", studentId: "a2", charges: [paid(25000), pending(25000)], usages: [use("2026-10-02")] }),
    ]);
    assert.deepEqual(
      out.map((l) => [l.studentPackageId, l.date, l.valueCents, l.paid]),
      [
        ["p1", "2026-10-01", 5000, true],
        ["p1", "2026-10-05", 5000, true],
        ["p2", "2026-10-02", 5000, false],
      ],
    );
  });

  it("aulas trazidas vêm primeiro e guardam o valor do pacote de onde vieram", () => {
    // p1: 10 aulas por R$ 500 (R$ 50 cada); 7 usadas, 3 foram para o p2.
    // p2: 8 aulas por R$ 320 (R$ 40 cada) + 3 trazidas do p1.
    const p1 = pkg({ id: "p1", usages: Array.from({ length: 7 }, (_, i) => use(`2026-09-0${i + 1}`)) });
    const p2 = pkg({
      id: "p2",
      lessonsTotal: 11,
      carriedOverLessons: 3,
      carriedFrom: [{ fromPackageId: "p1", lessons: 3 }],
      renewedFromId: "p1",
      charges: [paid(32000)],
      usages: [use("2026-10-01"), use("2026-10-02"), use("2026-10-03"), use("2026-10-04")],
    });
    const out = valuePackageLessons([p1, p2]).filter((l) => l.studentPackageId === "p2");
    assert.deepEqual(
      out.map((l) => [l.originPackageId, l.valueCents]),
      [
        ["p1", 5000],
        ["p1", 5000],
        ["p1", 5000],
        ["p2", 4000],
      ],
    );
  });

  it("aula trazida de pacote ainda não pago não entra, mesmo com o novo pago", () => {
    const p1 = pkg({ id: "p1", charges: [pending(50000)] });
    const p2 = pkg({
      id: "p2",
      lessonsTotal: 12,
      carriedOverLessons: 2,
      carriedFrom: [{ fromPackageId: "p1", lessons: 2 }],
      usages: [use("2026-10-01"), use("2026-10-02"), use("2026-10-03")],
    });
    const out = valuePackageLessons([p1, p2]);
    assert.deepEqual(out.map((l) => l.paid), [false, false, true]);
  });

  it("dado antigo sem a origem guardada usa o pacote anterior", () => {
    const legacy = { id: "p2", lessonsTotal: 12, carriedOverLessons: 2, renewedFromId: "p1" };
    assert.deepEqual(carriedLots(legacy), [{ fromPackageId: "p1", lessons: 2 }]);
    assert.deepEqual(lessonOrigins(legacy).slice(0, 3), ["p1", "p1", "p2"]);
  });

  it("renovação leva os lotes pela origem; aula devolvida sai da última posição usada", () => {
    // p2: 2 trazidas do p1 + 5 próprias; usou 3 (2 do p1 e 1 própria).
    const p2 = { id: "p2", lessonsTotal: 7, carriedOverLessons: 2, carriedFrom: [{ fromPackageId: "p1", lessons: 2 }] };
    assert.deepEqual(leftoverLots(p2, 3), [{ fromPackageId: "p2", lessons: 4 }]);
    assert.deepEqual(leftoverLots(p2, 1), [
      { fromPackageId: "p1", lessons: 1 },
      { fromPackageId: "p2", lessons: 5 },
    ]);
    assert.equal(lessonOriginAt(p2, 1), "p1");
    assert.equal(lessonOriginAt(p2, 2), "p2");
  });
});
