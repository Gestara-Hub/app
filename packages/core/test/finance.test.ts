import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TeacherPayComponent, TeacherPaySessionFact } from "@gestarahub/contracts";
import {
  addCompetence,
  attributeMembershipsToTeachers,
  competenceOf,
  computeTeacherPayout,
  dateInCompetence,
  describeTeacherPayRule,
  entryDisplayStatus,
  isEntryOverdue,
  isRuleEffective,
  lastCompetences,
  lastDayOfCompetence,
  materializeRecurrence,
  payoutTotalCents,
  recurrenceDueDate,
  summarizeByCategory,
  summarizeCashFlow,
  summarizeOverdueToDate,
  summarizeMonthlySeries,
  teacherPayoutDueDate,
  type CashFlowItem,
  type TeacherPayClassGroup,
  type TeacherPayEnrollment,
  type TeacherPayFacts,
  type TeacherPayMembership,
} from "../src/finance.ts";

// Fuso fixo (UTC-3, sem horario de verao) para os testes de data local.
// Cada arquivo roda no proprio processo do `node --test`.
process.env.TZ = "America/Sao_Paulo";

// Intl usa espaco nao separavel em "R$ 60,00"; normaliza para comparar.
const plain = (text: string) => text.replace(/\s/g, " ");

const COMP = "2026-10";

const rule = (components: TeacherPayComponent[], over: { status?: "active" | "inactive"; startCompetence?: string } = {}) => ({
  components,
  status: over.status ?? ("active" as const),
  startCompetence: over.startCompetence ?? "2026-01",
});

const facts = (over: Partial<TeacherPayFacts> = {}): TeacherPayFacts => ({
  professionalId: "t1",
  classGroups: [],
  sessionsDone: [],
  activeEnrollments: [],
  paidMemberships: [],
  ...over,
});

const session = (n: number, classGroupId: string, instructorId: string, primaryInstructorId = instructorId): TeacherPaySessionFact => ({
  sessionId: `s${n}`,
  classGroupId,
  date: `${COMP}-${String((n % 28) + 1).padStart(2, "0")}`,
  instructorId,
  primaryInstructorId,
});

const enroll = (studentId: string, classGroupId: string): TeacherPayEnrollment => ({ studentId, classGroupId });

const membership = (chargeId: string, studentId: string, amountCents: number, classGroupId?: string): TeacherPayMembership => ({
  chargeId,
  studentId,
  amountCents,
  classGroupId,
});

const brief = (lines: { kind: string; amountCents: number; quantity?: number; baseCents?: number }[]) =>
  lines.map((l) => ({ kind: l.kind, amountCents: l.amountCents, quantity: l.quantity, baseCents: l.baseCents }));

// ---------------------------------------------------------------------------
// Pagamento dos professores
// ---------------------------------------------------------------------------

describe("computeTeacherPayout: cada tipo de parte", () => {
  const groups: TeacherPayClassGroup[] = [
    { id: "g1", instructorId: "t1" },
    { id: "g2", instructorId: "t1" },
    { id: "g3", instructorId: "t2" },
  ];

  it("fixo mensal devolve o valor da regra", () => {
    const lines = computeTeacherPayout(rule([{ kind: "fixed_monthly", amountCents: 150000 }]), facts(), COMP);
    assert.deepEqual(brief(lines), [{ kind: "fixed_monthly", amountCents: 150000, quantity: undefined, baseCents: undefined }]);
    assert.equal(plain(lines[0].label), "Fixo mensal R$ 1.500,00");
  });

  it("por aula: 16 aulas × R$ 60 com 1 substituída paga 15 ao titular", () => {
    const sessionsDone = Array.from({ length: 16 }, (_, i) =>
      i === 0 ? session(i, "g1", "t2", "t1") : session(i, "g1", "t1"),
    );
    const f = facts({ classGroups: groups, sessionsDone });
    const lines = computeTeacherPayout(rule([{ kind: "per_session", amountCents: 6000 }]), f, COMP);
    assert.equal(lines[0].quantity, 15);
    assert.equal(lines[0].amountCents, 90000);
    assert.equal(plain(lines[0].label), "15 aulas × R$ 60,00");
  });

  it("por aula: a aula substituída conta para o substituto", () => {
    const sessionsDone = [session(1, "g1", "t2", "t1"), session(2, "g3", "t2")];
    const f = facts({ professionalId: "t2", classGroups: groups, sessionsDone });
    const lines = computeTeacherPayout(rule([{ kind: "per_session", amountCents: 6000 }]), f, COMP);
    assert.equal(lines[0].quantity, 2);
    assert.equal(lines[0].amountCents, 12000);
  });

  it("por aula: rótulo no singular com 1 aula", () => {
    const f = facts({ classGroups: groups, sessionsDone: [session(1, "g1", "t1")] });
    const lines = computeTeacherPayout(rule([{ kind: "per_session", amountCents: 6000 }]), f, COMP);
    assert.equal(plain(lines[0].label), "1 aula × R$ 60,00");
  });

  it("por aluno: conta cada aluno uma vez e só nas turmas em que é titular", () => {
    const f = facts({
      classGroups: groups,
      activeEnrollments: [enroll("a1", "g1"), enroll("a1", "g2"), enroll("a2", "g2"), enroll("a3", "g3")],
    });
    const lines = computeTeacherPayout(rule([{ kind: "per_student", amountCents: 2000 }]), f, COMP);
    assert.equal(lines[0].quantity, 2);
    assert.equal(lines[0].amountCents, 4000);
    assert.equal(plain(lines[0].label), "2 alunos × R$ 20,00");
  });

  it("% das mensalidades: base são as pagas atribuídas a ele", () => {
    const f = facts({
      classGroups: groups,
      activeEnrollments: [enroll("a1", "g1"), enroll("a2", "g3")],
      paidMemberships: [membership("c1", "a1", 20000), membership("c2", "a2", 20000)],
    });
    const lines = computeTeacherPayout(rule([{ kind: "percent_of_memberships", percent: 40 }]), f, COMP);
    assert.equal(lines[0].baseCents, 20000);
    assert.equal(lines[0].amountCents, 8000);
    assert.equal(plain(lines[0].label), "40% de R$ 200,00 em mensalidades");
    assert.equal(lines[0].source, "memberships");
  });

  it("% das mensalidades arredonda para baixo", () => {
    const f = facts({
      classGroups: groups,
      activeEnrollments: [enroll("a1", "g1")],
      paidMemberships: [membership("c1", "a1", 999)],
    });
    const lines = computeTeacherPayout(rule([{ kind: "percent_of_memberships", percent: 33 }]), f, COMP);
    assert.equal(lines[0].amountCents, 329); // 329,67 -> 329
  });

  it("% das mensalidades usa a turma da cobrança se o aluno não tiver matrícula", () => {
    const f = facts({ classGroups: groups, paidMemberships: [membership("c1", "a9", 10000, "g2")] });
    const lines = computeTeacherPayout(rule([{ kind: "percent_of_memberships", percent: 50 }]), f, COMP);
    assert.equal(lines[0].amountCents, 5000);
  });
});

describe("computeTeacherPayout: combinações, restrição e vigência", () => {
  const groups: TeacherPayClassGroup[] = [
    { id: "g1", instructorId: "t1" },
    { id: "g2", instructorId: "t1" },
  ];

  it("fixo R$ 800 + 30% das mensalidades soma as duas linhas", () => {
    const f = facts({
      classGroups: groups,
      activeEnrollments: [enroll("a1", "g1"), enroll("a2", "g2")],
      paidMemberships: [membership("c1", "a1", 15000), membership("c2", "a2", 15000)],
    });
    const lines = computeTeacherPayout(
      rule([{ kind: "fixed_monthly", amountCents: 80000 }, { kind: "percent_of_memberships", percent: 30 }]),
      f,
      COMP,
    );
    assert.deepEqual(
      lines.map((l) => [l.kind, l.amountCents]),
      [
        ["fixed_monthly", 80000],
        ["percent_of_memberships", 9000],
      ],
    );
    assert.equal(payoutTotalCents(lines), 89000);
  });

  it("classGroupIds restringe aulas, alunos e mensalidades às turmas listadas", () => {
    const f = facts({
      classGroups: groups,
      sessionsDone: [session(1, "g1", "t1"), session(2, "g2", "t1"), session(3, "g2", "t1")],
      activeEnrollments: [enroll("a1", "g1"), enroll("a2", "g2"), enroll("a3", "g2")],
      paidMemberships: [membership("c1", "a1", 10000), membership("c2", "a2", 10000)],
    });
    const only = ["g1"];
    const lines = computeTeacherPayout(
      rule([
        { kind: "per_session", amountCents: 5000, classGroupIds: only },
        { kind: "per_student", amountCents: 1000, classGroupIds: only },
        { kind: "percent_of_memberships", percent: 50, classGroupIds: only },
      ]),
      f,
      COMP,
    );
    assert.deepEqual(brief(lines), [
      { kind: "per_session", amountCents: 5000, quantity: 1, baseCents: undefined },
      { kind: "per_student", amountCents: 1000, quantity: 1, baseCents: undefined },
      { kind: "percent_of_memberships", amountCents: 5000, quantity: undefined, baseCents: 10000 },
    ]);
  });

  it("classGroupIds vazio vale para todas as turmas", () => {
    const f = facts({ classGroups: groups, sessionsDone: [session(1, "g1", "t1"), session(2, "g2", "t1")] });
    const lines = computeTeacherPayout(rule([{ kind: "per_session", amountCents: 5000, classGroupIds: [] }]), f, COMP);
    assert.equal(lines[0].quantity, 2);
  });

  it("regra inativa ou com vigência futura devolve []", () => {
    const fixed: TeacherPayComponent[] = [{ kind: "fixed_monthly", amountCents: 80000 }];
    assert.deepEqual(computeTeacherPayout(rule(fixed, { status: "inactive" }), facts(), COMP), []);
    assert.deepEqual(computeTeacherPayout(rule(fixed, { startCompetence: "2026-11" }), facts(), COMP), []);
    assert.equal(computeTeacherPayout(rule(fixed, { startCompetence: COMP }), facts(), COMP).length, 1);
  });

  it("valor negativo vira zero e o percentual fica entre 0 e 100", () => {
    const f = facts({
      classGroups: groups,
      activeEnrollments: [enroll("a1", "g1")],
      paidMemberships: [membership("c1", "a1", 10000)],
    });
    const lines = computeTeacherPayout(
      rule([{ kind: "fixed_monthly", amountCents: -500 }, { kind: "percent_of_memberships", percent: 150 }]),
      f,
      COMP,
    );
    assert.deepEqual(lines.map((l) => l.amountCents), [0, 10000]);
  });
});

describe("attributeMembershipsToTeachers", () => {
  const classGroups: TeacherPayClassGroup[] = [
    { id: "g1", instructorId: "t1" },
    { id: "g2", instructorId: "t1" },
    { id: "g3", instructorId: "t2" },
    { id: "g4", instructorId: "t3" },
  ];

  it("turma de mensalidade paga com pacote pelo aluno nao recebe parte da mensalidade", () => {
    const [a] = attributeMembershipsToTeachers({
      memberships: [membership("c1", "a1", 20000)],
      enrollments: [enroll("a1", "g1"), { ...enroll("a1", "g3"), paysWithPackage: true }],
      classGroups,
    });
    assert.deepEqual(
      a.shares.map((s) => [s.professionalId, s.amountCents]),
      [["t1", 20000]],
    );
  });

  it("divide igualmente entre os titulares distintos", () => {
    const [a] = attributeMembershipsToTeachers({
      memberships: [membership("c1", "a1", 20000)],
      enrollments: [enroll("a1", "g1"), enroll("a1", "g3")],
      classGroups,
    });
    assert.deepEqual(
      a.shares.map((s) => [s.professionalId, s.amountCents]),
      [
        ["t1", 10000],
        ["t2", 10000],
      ],
    );
    assert.equal(a.remainderCents, 0);
  });

  it("arredonda para baixo e a sobra fica com a academia", () => {
    const [a] = attributeMembershipsToTeachers({
      memberships: [membership("c1", "a1", 10000)],
      enrollments: [enroll("a1", "g1"), enroll("a1", "g3"), enroll("a1", "g4")],
      classGroups,
    });
    assert.deepEqual(a.shares.map((s) => s.amountCents), [3333, 3333, 3333]);
    assert.equal(a.remainderCents, 1);
  });

  it("aluno em duas turmas do mesmo professor gera uma parte só, com as duas turmas", () => {
    const [a] = attributeMembershipsToTeachers({
      memberships: [membership("c1", "a1", 15000)],
      enrollments: [enroll("a1", "g1"), enroll("a1", "g2")],
      classGroups,
    });
    assert.equal(a.shares.length, 1);
    assert.deepEqual(a.shares[0], { professionalId: "t1", amountCents: 15000, classGroupIds: ["g1", "g2"] });
    assert.equal(a.remainderCents, 0);
  });

  it("aluno sem turma conhecida não gera parte (tudo fica de sobra)", () => {
    const [a] = attributeMembershipsToTeachers({
      memberships: [membership("c1", "a1", 15000, "g-unknown")],
      enrollments: [enroll("a1", "g-unknown")],
      classGroups,
    });
    assert.deepEqual(a.shares, []);
    assert.equal(a.remainderCents, 15000);
  });
});

describe("payoutTotalCents, isRuleEffective, describeTeacherPayRule e vencimento", () => {
  it("payoutTotalCents soma ajustes e nunca fica negativo", () => {
    assert.equal(
      payoutTotalCents([
        { kind: "fixed_monthly", label: "", amountCents: 80000 },
        { kind: "adjustment", label: "Vale", amountCents: -20000 },
      ]),
      60000,
    );
    assert.equal(payoutTotalCents([{ kind: "adjustment", label: "Vale", amountCents: -5000 }]), 0);
    assert.equal(payoutTotalCents([]), 0);
  });

  it("isRuleEffective exige regra ativa e vigência iniciada", () => {
    assert.equal(isRuleEffective({ status: "active", startCompetence: "2026-10" }, "2026-10"), true);
    assert.equal(isRuleEffective({ status: "active", startCompetence: "2026-10" }, "2026-09"), false);
    assert.equal(isRuleEffective({ status: "active", startCompetence: "2025-12" }, "2026-01"), true);
    assert.equal(isRuleEffective({ status: "inactive", startCompetence: "2026-01" }, "2026-10"), false);
  });

  it("describeTeacherPayRule resume fixo + %", () => {
    const text = describeTeacherPayRule({
      components: [
        { kind: "fixed_monthly", amountCents: 80000 },
        { kind: "percent_of_memberships", percent: 30 },
      ],
    });
    assert.equal(plain(text), "Fixo R$ 800,00 + 30% do que os alunos pagaram");
  });

  it("describeTeacherPayRule marca as turmas selecionadas e usa vírgula decimal", () => {
    const text = describeTeacherPayRule({
      components: [
        { kind: "per_session", amountCents: 6000, classGroupIds: ["g1"] },
        { kind: "per_student", amountCents: 2000 },
        { kind: "percent_of_memberships", percent: 12.5 },
      ],
    });
    assert.equal(plain(text), "R$ 60,00 por aula (turmas selecionadas) + R$ 20,00 por aluno + 12,5% do que os alunos pagaram");
  });

  it("teacherPayoutDueDate vence no dia da regra do mês seguinte (padrão dia 5)", () => {
    assert.equal(teacherPayoutDueDate("2026-10"), "2026-11-05");
    assert.equal(teacherPayoutDueDate("2026-12", 10), "2027-01-10");
  });
});

// ---------------------------------------------------------------------------
// Recorrência
// ---------------------------------------------------------------------------

describe("materializeRecurrence e recurrenceDueDate", () => {
  const recurrence = { startCompetence: "2026-08", status: "active" as const };

  it("gera do início até a competência pedida", () => {
    assert.deepEqual(materializeRecurrence(recurrence, [], "2026-11"), ["2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("é idempotente: rodar de novo com o resultado aplicado não duplica", () => {
    const first = materializeRecurrence(recurrence, ["2026-08"], "2026-11");
    assert.deepEqual(first, ["2026-09", "2026-10", "2026-11"]);
    const second = materializeRecurrence(recurrence, ["2026-08", ...first], "2026-11");
    assert.deepEqual(second, []);
  });

  it("respeita o endCompetence", () => {
    const ended = { ...recurrence, endCompetence: "2026-09" };
    assert.deepEqual(materializeRecurrence(ended, [], "2026-12"), ["2026-08", "2026-09"]);
    // fim depois do limite: vale o limite pedido
    assert.deepEqual(materializeRecurrence({ ...recurrence, endCompetence: "2027-06" }, [], "2026-09"), [
      "2026-08",
      "2026-09",
    ]);
  });

  it("recorrência inativa não gera nada", () => {
    assert.deepEqual(materializeRecurrence({ ...recurrence, status: "inactive" }, [], "2026-12"), []);
  });

  it("início depois do limite não gera nada", () => {
    assert.deepEqual(materializeRecurrence({ ...recurrence, startCompetence: "2027-01" }, [], "2026-12"), []);
  });

  it("recurrenceDueDate usa o dia da recorrência na competência", () => {
    assert.equal(recurrenceDueDate({ dayOfMonth: 10 }, "2026-10"), "2026-10-10");
    assert.equal(recurrenceDueDate({ dayOfMonth: 31 }, "2026-02"), "2026-02-28");
  });
});

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

const item = (over: Partial<CashFlowItem>): CashFlowItem => ({
  type: "income",
  amountCents: 10000,
  dueDate: "2026-10-10",
  status: "pending",
  ...over,
});

describe("summarizeCashFlow", () => {
  const today = "2026-10-15";

  it("separa pago, previsto e atrasado e calcula o resultado", () => {
    const items: CashFlowItem[] = [
      item({ amountCents: 15000, status: "paid", paidAt: "2026-10-05T13:00:00.000Z" }),
      item({ amountCents: 5000, status: "paid", paidAt: "2026-10-20T13:00:00.000Z", dueDate: "2026-11-05" }),
      item({ type: "expense", amountCents: 8000, status: "paid", paidAt: "2026-10-03T12:00:00.000Z" }),
      item({ amountCents: 3000, dueDate: "2026-10-10" }), // atrasado (antes de hoje)
      item({ amountCents: 4000, dueDate: "2026-10-25" }), // a receber
      item({ amountCents: 2000, status: "overdue", dueDate: "2026-10-20" }), // overdue gravado
      item({ type: "expense", amountCents: 6000, dueDate: "2026-10-12" }), // a pagar atrasado
      item({ type: "expense", amountCents: 7000, dueDate: "2026-10-30" }), // a pagar
      item({ amountCents: 9999, status: "canceled", dueDate: "2026-10-10" }), // ignorado
      item({ amountCents: 9999, dueDate: "2026-09-10" }), // outra competência
      item({ amountCents: 9999, status: "paid", paidAt: "2026-09-28T12:00:00.000Z" }), // pago em setembro
    ];
    assert.deepEqual(summarizeCashFlow(items, "2026-10", today), {
      competence: "2026-10",
      incomePaidCents: 20000,
      expensePaidCents: 8000,
      resultCents: 12000,
      incomeForecastCents: 9000,
      expenseForecastCents: 13000,
      incomeOverdueCents: 5000,
      expenseOverdueCents: 6000,
    });
  });

  it("pago usa a data LOCAL do paidAt (00:30 UTC de 01/11 ainda é outubro)", () => {
    const items = [item({ status: "paid", paidAt: "2026-11-01T00:30:00.000Z", amountCents: 7000 })];
    assert.equal(summarizeCashFlow(items, "2026-10", "2026-11-01").incomePaidCents, 7000);
    assert.equal(summarizeCashFlow(items, "2026-11", "2026-11-01").incomePaidCents, 0);
  });

  it("a receber e atraso usam o mês de referência quando o item tem (cobrança pós-paga)", () => {
    // Mensalidade de setembro que vence em 10/10: é de setembro, não de outubro.
    const items = [item({ amountCents: 4000, dueDate: "2026-10-10", competence: "2026-09" })];
    assert.equal(summarizeCashFlow(items, "2026-10", today).incomeForecastCents, 0);
    const sept = summarizeCashFlow(items, "2026-09", today);
    assert.equal(sept.incomeForecastCents, 4000);
    assert.equal(sept.incomeOverdueCents, 4000);
    assert.deepEqual(summarizeOverdueToDate(items, today).incomeByCompetence, [{ competence: "2026-09", amountCents: 4000 }]);
  });

  it("status paid sem paidAt não entra em nada", () => {
    const s = summarizeCashFlow([item({ status: "paid" })], "2026-10", today);
    assert.equal(s.incomePaidCents, 0);
    assert.equal(s.incomeForecastCents, 0);
  });
});

describe("summarizeOverdueToDate", () => {
  it("soma o atrasado de todos os meses, entradas por mês do vencimento", () => {
    const items: CashFlowItem[] = [
      item({ amountCents: 3000, dueDate: "2026-08-10" }),
      item({ amountCents: 2000, dueDate: "2026-10-10" }),
      item({ amountCents: 1000, dueDate: "2026-08-20" }),
      item({ amountCents: 500, status: "overdue", dueDate: "2026-10-20" }), // overdue gravado
      item({ amountCents: 9999, dueDate: "2026-10-15" }), // vence hoje: ainda não
      item({ amountCents: 9999, status: "paid", paidAt: "2026-10-01T12:00:00.000Z", dueDate: "2026-08-01" }),
      item({ amountCents: 9999, status: "canceled", dueDate: "2026-08-01" }),
      item({ type: "expense", amountCents: 700, dueDate: "2026-09-05" }),
    ];
    assert.deepEqual(summarizeOverdueToDate(items, "2026-10-15"), {
      incomeCents: 6500,
      incomeCount: 4,
      expenseCents: 700,
      incomeByCompetence: [
        { competence: "2026-08", amountCents: 4000 },
        { competence: "2026-10", amountCents: 2500 },
      ],
    });
  });
});

describe("summarizeMonthlySeries", () => {
  it("soma pagos por competência na ordem pedida, com zeros nos meses vazios", () => {
    const items: CashFlowItem[] = [
      item({ amountCents: 10000, status: "paid", paidAt: "2026-08-10T12:00:00.000Z" }),
      item({ amountCents: 20000, status: "paid", paidAt: "2026-10-10T12:00:00.000Z" }),
      item({ type: "expense", amountCents: 5000, status: "paid", paidAt: "2026-10-11T12:00:00.000Z" }),
      item({ amountCents: 99999 }), // pendente
      item({ amountCents: 99999, status: "paid", paidAt: "2026-05-10T12:00:00.000Z" }), // fora da janela
    ];
    assert.deepEqual(summarizeMonthlySeries(items, ["2026-08", "2026-09", "2026-10"]), [
      { competence: "2026-08", incomeCents: 10000, expenseCents: 0, resultCents: 10000 },
      { competence: "2026-09", incomeCents: 0, expenseCents: 0, resultCents: 0 },
      { competence: "2026-10", incomeCents: 20000, expenseCents: 5000, resultCents: 15000 },
    ]);
  });
});

describe("summarizeByCategory", () => {
  const categories = [
    { id: "rent", name: "Aluguel", type: "expense" as const },
    { id: "power", name: "Energia", type: "expense" as const },
    { id: "memberships", name: "Mensalidades", type: "income" as const, system: true },
    { id: "products", name: "Produtos", type: "income" as const },
    { id: "empty", name: "Sem movimento", type: "expense" as const },
  ];
  const paid = (categoryId: string, amountCents: number, type: CashFlowItem["type"], paidAt = "2026-10-10T12:00:00.000Z") =>
    item({ categoryId, amountCents, type, status: "paid", paidAt });

  it("totaliza pagos do mês, percentual sobre o mesmo tipo e ordena do maior", () => {
    const items: CashFlowItem[] = [
      paid("memberships", 30000, "income"),
      paid("memberships", 30000, "income"),
      paid("products", 20000, "income"),
      paid("rent", 15000, "expense"),
      paid("power", 5000, "expense"),
      paid("rent", 99999, "expense", "2026-09-10T12:00:00.000Z"), // outro mês
      item({ categoryId: "power", type: "expense", amountCents: 99999 }), // pendente
      item({ type: "income", amountCents: 99999, status: "paid", paidAt: "2026-10-10T12:00:00.000Z" }), // sem categoria
    ];
    assert.deepEqual(summarizeByCategory(items, categories, "2026-10"), [
      { categoryId: "memberships", categoryName: "Mensalidades", type: "income", system: true, totalCents: 60000, percent: 75 },
      { categoryId: "products", categoryName: "Produtos", type: "income", system: undefined, totalCents: 20000, percent: 25 },
      { categoryId: "rent", categoryName: "Aluguel", type: "expense", system: undefined, totalCents: 15000, percent: 75 },
      { categoryId: "power", categoryName: "Energia", type: "expense", system: undefined, totalCents: 5000, percent: 25 },
    ]);
  });

  it("percentual com uma casa decimal", () => {
    const items = [paid("rent", 10000, "expense"), paid("power", 20000, "expense")];
    const out = summarizeByCategory(items, categories, "2026-10");
    assert.deepEqual(out.map((c) => c.percent), [66.7, 33.3]);
  });
});

// ---------------------------------------------------------------------------
// Datas e status
// ---------------------------------------------------------------------------

describe("helpers de competência e data", () => {
  it("competenceOf usa a data LOCAL de um timestamp UTC", () => {
    // 01/10 02:00 UTC = 30/09 23:00 em UTC-3
    assert.equal(competenceOf("2026-10-01T02:00:00.000Z"), "2026-09");
    assert.equal(competenceOf("2026-10-01T03:00:00.000Z"), "2026-10");
    assert.equal(competenceOf("2026-10-31"), "2026-10");
  });

  it("addCompetence atravessa a virada do ano nos dois sentidos", () => {
    assert.equal(addCompetence("2026-12", 1), "2027-01");
    assert.equal(addCompetence("2026-01", -1), "2025-12");
    assert.equal(addCompetence("2026-10", 0), "2026-10");
    assert.equal(addCompetence("2026-10", 15), "2028-01");
    assert.equal(addCompetence("2026-03", -14), "2025-01");
  });

  it("lastCompetences devolve as últimas N em ordem cronológica", () => {
    assert.deepEqual(lastCompetences("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
    assert.deepEqual(lastCompetences("2026-10", 1), ["2026-10"]);
  });

  it("lastDayOfCompetence considera meses curtos e ano bissexto", () => {
    assert.equal(lastDayOfCompetence("2026-10"), "2026-10-31");
    assert.equal(lastDayOfCompetence("2026-09"), "2026-09-30");
    assert.equal(lastDayOfCompetence("2026-02"), "2026-02-28");
    assert.equal(lastDayOfCompetence("2028-02"), "2028-02-29");
  });

  it("dateInCompetence aceita até 31 e cai no último dia dos meses curtos", () => {
    assert.equal(dateInCompetence("2026-10", 5), "2026-10-05");
    assert.equal(dateInCompetence("2026-02", 31), "2026-02-28");
    assert.equal(dateInCompetence("2028-02", 30), "2028-02-29");
    assert.equal(dateInCompetence("2026-11", 31), "2026-11-30");
    assert.equal(dateInCompetence("2026-10", 30), "2026-10-30");
    assert.equal(dateInCompetence("2026-10", 31), "2026-10-31");
    assert.equal(dateInCompetence("2026-10", 0), "2026-10-01");
    assert.equal(dateInCompetence("2026-10", -3), "2026-10-01");
  });
});

describe("isEntryOverdue / entryDisplayStatus", () => {
  const today = "2026-10-15";

  it("pendente com vencimento antes de hoje fica atrasado", () => {
    assert.equal(isEntryOverdue({ status: "pending", dueDate: "2026-10-14" }, today), true);
    assert.equal(entryDisplayStatus({ status: "pending", dueDate: "2026-10-14" }, today), "overdue");
  });

  it("vencendo hoje ainda não está atrasado", () => {
    assert.equal(isEntryOverdue({ status: "pending", dueDate: today }, today), false);
    assert.equal(entryDisplayStatus({ status: "pending", dueDate: today }, today), "pending");
  });

  it("pago e cancelado nunca ficam atrasados", () => {
    assert.equal(entryDisplayStatus({ status: "paid", dueDate: "2026-09-01" }, today), "paid");
    assert.equal(entryDisplayStatus({ status: "canceled", dueDate: "2026-09-01" }, today), "canceled");
  });

  it("overdue gravado continua atrasado", () => {
    assert.equal(isEntryOverdue({ status: "overdue", dueDate: "2026-12-01" }, today), true);
  });
});

describe("data do pagamento no fuso do espaço (revisão de valores, 30/10/2026)", () => {
  it("23:30 de 31/10 em Manaus é outubro no espaço de Manaus e novembro em Brasília", async () => {
    const { competenceOf, localDateOf } = await import("@gestarahub/core/finance");
    const { setSpaceTimeZoneProvider } = await import("@gestarahub/core/date");
    const paidAt = "2026-11-01T03:30:00.000Z"; // 23:30 de 31/10 em Manaus (UTC-4); 00:30 de 01/11 em Brasília
    setSpaceTimeZoneProvider(() => "America/Manaus");
    try {
      assert.equal(localDateOf(paidAt), "2026-10-31");
      assert.equal(competenceOf(paidAt), "2026-10");
    } finally {
      setSpaceTimeZoneProvider(undefined);
    }
    assert.equal(competenceOf(paidAt), "2026-11");
    // Data pura passa como está.
    assert.equal(localDateOf("2026-10-31"), "2026-10-31");
  });
});
