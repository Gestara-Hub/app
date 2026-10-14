import type { Charge, Client, CreateExtraCharge } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService, membershipPeriodTaken } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { financeService } from "@/services/financeService";
import { onlinePaymentsService } from "@/services/onlinePaymentsService";
import { subscriptionService } from "@/services/subscriptionService";
import { teacherPayService } from "@/services/teacherPayService";
import { turmasService } from "@/services/turmasService";
import {
  ACADEMY_UNIT,
  createClass,
  createInstructor,
  createPlan,
  createStudent,
  enrollStudent,
  resetAcademy,
} from "@/test/academy";

/**
 * Cobranca avulsa (doc 20, fase A): taxa, material, uniforme, exame ou evento,
 * a vista ou em ate 12 parcelas. Hoje congelado em 22/09/2026.
 */

/** Moeda formatada usa espaço não separável; os asserts usam espaço comum. */
const plain = (text: string) => text.replace(/ /g, " ");
const lastAudit = () => plain(store.auditLog.at(-1)?.summary ?? "");
const extrasOf = (studentId: string): Charge[] =>
  store.charges
    .filter((c) => c.kind === "extra" && c.studentId === studentId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const brief = (c: Charge) => `${c.dueDate} ${c.amountCents} ${c.status}`;

function extra(student: Client, over: Partial<CreateExtraCharge> = {}): CreateExtraCharge {
  return {
    studentId: student.id,
    description: "Kimono",
    totalCents: 25000,
    firstDueDate: "2026-09-22",
    installments: 1,
    ...over,
  };
}

describe("cobrança avulsa: lançar", () => {
  beforeEach(() => resetAcademy());

  it("à vista: uma cobrança extra pendente, na competência do vencimento, com unidade e auditoria", async () => {
    const student = await createStudent("Bruna");
    const before = store.auditLog.length;
    const [view] = await billingService.createExtraCharge(extra(student, { description: "  Kimono  " }));

    const charges = extrasOf(student.id);
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      kind: "extra",
      status: "pending",
      description: "Kimono",
      amountCents: 25000,
      dueDate: "2026-09-22",
      competence: "2026-09",
      unitId: ACADEMY_UNIT,
      organizationId: store.organization.id,
    });
    expect(charges[0].installmentGroupId).toBeUndefined();
    expect(charges[0].cycleTotal).toBeUndefined();
    expect(charges[0].planId).toBeUndefined();
    // Read-model: sem plano, com a descrição.
    expect(view).toMatchObject({ studentName: "Bruna", description: "Kimono", cycleIndex: 1, cycleTotal: 1 });
    expect(view.planName).toBeUndefined();
    expect(store.auditLog.length).toBe(before + 1);
    expect(lastAudit()).toBe('Ana Ribeiro lançou a cobrança avulsa "Kimono" para Bruna (R$ 250,00)');
  });

  it("3 parcelas: o resto dos centavos na primeira, vencimentos mensais, mesmo grupo e uma auditoria só", async () => {
    const student = await createStudent("Caio");
    const before = store.auditLog.length;
    const created = await billingService.createExtraCharge(
      extra(student, { description: "Taxa de matrícula", totalCents: 10000, firstDueDate: "2026-10-10", installments: 3 }),
    );

    expect(created).toHaveLength(3);
    const charges = extrasOf(student.id);
    expect(charges.map(brief)).toEqual([
      "2026-10-10 3334 pending",
      "2026-11-10 3333 pending",
      "2026-12-10 3333 pending",
    ]);
    expect(charges.map((c) => c.competence)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(charges.map((c) => `${c.cycleIndex}/${c.cycleTotal}`)).toEqual(["1/3", "2/3", "3/3"]);
    const groupId = charges[0].installmentGroupId;
    expect(groupId).toBeTruthy();
    expect(charges.every((c) => c.installmentGroupId === groupId && c.description === "Taxa de matrícula")).toBe(true);
    expect(store.auditLog.length).toBe(before + 1);
    expect(lastAudit()).toBe(
      'Ana Ribeiro lançou a cobrança avulsa "Taxa de matrícula" para Caio (R$ 100,00, em 3 parcelas)',
    );
  });

  it("vencimento no dia 31 cai no último dia dos meses curtos", async () => {
    const student = await createStudent("Dani");
    await billingService.createExtraCharge(
      extra(student, { totalCents: 30000, firstDueDate: "2027-01-31", installments: 3 }),
    );
    expect(extrasOf(student.id).map((c) => c.dueDate)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("listagem: filtro por tipo e competência", async () => {
    const student = await createStudent("Eva");
    await billingService.createExtraCharge(extra(student, { totalCents: 9000, installments: 3 }));
    const september = await billingService.listCharges({ competence: "2026-09", kind: "extra" });
    expect(september.map((c) => `${c.description} ${c.cycleIndex}/${c.cycleTotal} ${c.amountCents}`)).toEqual([
      "Kimono 1/3 3000",
    ]);
    const october = await billingService.listCharges({ competence: "2026-10", kind: "extra" });
    expect(october.map((c) => c.cycleIndex)).toEqual([2]);
    expect(await billingService.listCharges({ competence: "2026-09", kind: "membership" })).toEqual([]);
  });

  it("validação: erros por campo", async () => {
    await expect(
      billingService.createExtraCharge({
        studentId: "",
        description: "  ",
        totalCents: 0,
        firstDueDate: "",
        installments: 0,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [
        { field: "studentId", message: "Selecione o aluno." },
        { field: "description", message: "Descreva a cobrança." },
        { field: "totalCents", message: "Informe o valor." },
        { field: "firstDueDate", message: "Informe o vencimento." },
        { field: "installments", message: "Escolha de 1 a 12 parcelas." },
      ],
    });
    const student = await createStudent("Fabi");
    await expect(
      billingService.createExtraCharge(extra(student, { description: "x".repeat(81) })),
    ).rejects.toMatchObject({ fields: [{ field: "description", message: "Use no máximo 80 caracteres." }] });
    await expect(
      billingService.createExtraCharge(extra(student, { installments: 13 })),
    ).rejects.toMatchObject({ fields: [{ field: "installments" }] });
    await expect(
      billingService.createExtraCharge(extra(student, { firstDueDate: "2026-02-30" })),
    ).rejects.toMatchObject({ fields: [{ field: "firstDueDate", message: "Informe o vencimento." }] });
    // Parcela de R$ 0 não é cobrança.
    await expect(
      billingService.createExtraCharge(extra(student, { totalCents: 2, installments: 3 })),
    ).rejects.toMatchObject({ fields: [{ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." }] });
    expect(extrasOf(student.id)).toHaveLength(0);
  });

  it("recusa aluno desconhecido ou inativo", async () => {
    await expect(
      billingService.createExtraCharge({ ...extra({ id: "nao-existe" } as Client) }),
    ).rejects.toMatchObject({ fields: [{ field: "studentId", message: "Aluno não encontrado." }] });
    const student = await createStudent("Gil");
    await clientsService.remove(student.id);
    await expect(billingService.createExtraCharge(extra(student))).rejects.toMatchObject({
      fields: [{ field: "studentId", message: "Aluno inativo. Reative o cadastro para lançar a cobrança." }],
    });
    expect(store.charges.filter((c) => c.kind === "extra")).toHaveLength(0);
  });
});

describe("cobrança avulsa: ações de Mensalidades", () => {
  beforeEach(() => resetAcademy());

  it("pagar, recusar pagar de novo, desfazer, cancelar com motivo e reabrir", async () => {
    const student = await createStudent("Hugo");
    await billingService.createExtraCharge(extra(student, { totalCents: 9000, installments: 3 }));
    const second = extrasOf(student.id)[1];

    const paid = await billingService.markPaid(second.id, "pix");
    expect(paid).toMatchObject({ status: "paid", method: "pix", paidVia: "manual" });
    expect(lastAudit()).toBe(
      'Ana Ribeiro registrou o pagamento da parcela 2 de 3 da cobrança avulsa "Kimono" de Hugo (R$ 30,00, vence 22/10/2026)',
    );
    await expect(billingService.markPaid(second.id, "cash")).rejects.toMatchObject({
      httpStatus: 409,
      message: "Esta cobrança já está paga.",
    });

    await billingService.markPending(second.id);
    expect(extrasOf(student.id)[1].status).toBe("pending");

    await billingService.cancelCharge(second.id, "Lançada por engano");
    expect(extrasOf(student.id)[1]).toMatchObject({ status: "canceled", canceledBy: "user", cancelReason: "Lançada por engano" });
    expect(lastAudit()).toBe(
      'Ana Ribeiro cancelou a parcela 2 de 3 da cobrança avulsa "Kimono" de Hugo (R$ 30,00, vence 22/10/2026): Lançada por engano',
    );

    await billingService.reopenCharge(second.id);
    expect(extrasOf(student.id)[1]).toMatchObject({ status: "pending" });
    expect(extrasOf(student.id)[1].cancelReason).toBeUndefined();
  });

  it("à vista: o rótulo não fala em parcela", async () => {
    const student = await createStudent("Iris");
    const [c] = await billingService.createExtraCharge(extra(student));
    await billingService.markPaid(c.id, "cash");
    expect(lastAudit()).toBe(
      'Ana Ribeiro registrou o pagamento da cobrança avulsa "Kimono" de Iris (R$ 250,00, vence 22/09/2026)',
    );
  });

  it("reabrir não checa período de mensalidade (avulsa convive com a mensalidade do mês)", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ plan, name: "Jade", startDate: "2026-09-01", strategy: "full_cycle" });
    const [c] = await billingService.createExtraCharge(extra(student, { firstDueDate: "2026-09-01" }));
    await billingService.cancelCharge(c.id);
    await expect(billingService.reopenCharge(c.id)).resolves.toMatchObject({ status: "overdue" });
  });

  it("atrasada é derivada na leitura, como nas mensalidades", async () => {
    const student = await createStudent("Leo");
    await billingService.createExtraCharge(extra(student, { firstDueDate: "2026-09-10" }));
    const [view] = await billingService.listCharges({ kind: "extra", studentId: student.id });
    expect(view.status).toBe("overdue");
  });
});

describe("cobrança avulsa: pagamento online (Pro)", () => {
  beforeEach(async () => {
    resetAcademy();
    await subscriptionService.setTier("pro");
    await onlinePaymentsService.updateSettings({ enabled: true });
  });

  it("gera Pix para a avulsa; marcar pago na mão cancela o código em aberto", async () => {
    const student = await createStudent("Mia");
    const [c] = await billingService.createExtraCharge(extra(student, { totalCents: 12000, installments: 2 }));
    const pix = await onlinePaymentsService.createForCharge(c.id, "pix");
    expect(pix).toMatchObject({ status: "awaiting", amountCents: 6000, chargeId: c.id });
    expect(lastAudit()).toBe(
      'Ana Ribeiro gerou a cobrança online por Pix da parcela 1 de 2 da cobrança avulsa "Kimono" de Mia (R$ 60,00)',
    );

    await billingService.markPaid(c.id, "cash");
    expect(store.onlinePayments.find((p) => p.id === pix.id)?.status).toBe("canceled");
  });

  it("pago pela simulação do Pix: fica pago online", async () => {
    const student = await createStudent("Nina");
    const [c] = await billingService.createExtraCharge(extra(student));
    const pix = await onlinePaymentsService.createForCharge(c.id, "pix");
    await onlinePaymentsService.simulatePaid(pix.id);
    expect(store.charges.find((x) => x.id === c.id)).toMatchObject({ status: "paid", paidVia: "online" });
  });
});

describe("cobrança avulsa: mensalidades não são afetadas", () => {
  beforeEach(() => resetAcademy());

  it("avulsa no mês não ocupa o período da mensalidade nem impede a geração", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ plan, name: "Otto", startDate: "2026-09-01", strategy: "full_cycle" });
    // Sem a mensalidade de setembro, só com uma avulsa no mesmo mês.
    store.charges = store.charges.filter((c) => c.kind !== "membership");
    await billingService.createExtraCharge(extra(student, { description: "Taxa de matrícula", firstDueDate: "2026-09-01" }));
    expect(
      membershipPeriodTaken(student.id, plan.id, {
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        competence: "2026-09",
        cycleIndex: 1,
      }),
    ).toBe(false);

    expect(await billingService.generateCharges("2026-09")).toEqual({ created: 1 });
    const kinds = store.charges.filter((c) => c.studentId === student.id).map((c) => `${c.kind} ${c.amountCents}`);
    expect(kinds.sort()).toEqual(["extra 25000", "membership 15000"]);
  });

  it("troca de plano não cancela as avulsas em aberto", async () => {
    const plan = await createPlan("monthly", 15000, "Básico");
    const other = await createPlan("monthly", 20000, "Pro");
    const student = await enrollStudent({ plan, name: "Paulo", startDate: "2026-09-01", strategy: "full_cycle" });
    await billingService.createExtraCharge(extra(student, { totalCents: 9000, installments: 3 }));
    await clientsService.update(student.id, { planId: other.id, planStartDate: "2026-10-01" });
    expect(extrasOf(student.id).map((c) => c.status)).toEqual(["pending", "pending", "pending"]);
  });

  it("inativar mantém as avulsas em aberto (inclusive parcelas futuras), mesmo cancelando as mensalidades", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ plan, name: "Rui", startDate: "2026-09-01", strategy: "full_cycle" });
    await billingService.createExtraCharge(extra(student, { totalCents: 9000, installments: 3, firstDueDate: "2026-09-10" }));
    const paidOne = extrasOf(student.id)[0];
    await billingService.markPaid(paidOne.id, "pix");

    await clientsService.remove(student.id, { cancelOpenCharges: true });

    expect(extrasOf(student.id).map(brief)).toEqual([
      "2026-09-10 3000 paid",
      "2026-10-10 3000 pending",
      "2026-11-10 3000 pending",
    ]);
    // A mensalidade em aberto do período já iniciado foi cancelada (escolha do usuário).
    const membership = store.charges.find((c) => c.studentId === student.id && c.kind === "membership");
    expect(membership).toMatchObject({ status: "canceled", cancelReason: "Aluno inativado" });
  });
});

describe("cobrança avulsa: financeiro e professores", () => {
  beforeEach(() => resetAcademy());

  it("entra no Financeiro na categoria de sistema Cobranças avulsas", async () => {
    const student = await createStudent("Sara");
    await billingService.createExtraCharge(extra(student, { totalCents: 9000, installments: 3, firstDueDate: "2026-09-10" }));
    await billingService.createExtraCharge(extra(student, { description: "Evento", totalCents: 5000, firstDueDate: "2026-09-25" }));
    const [first] = extrasOf(student.id);
    await billingService.markPaid(first.id, "pix");

    const category = store.financialCategories.find((c) => c.systemKey === "extras");
    expect(category).toMatchObject({ name: "Cobranças avulsas", type: "income", system: true });

    const rows = await financeService.listEntries({ competence: "2026-09" });
    const row = rows.find((r) => r.id === "charges:extra:2026-09");
    expect(row).toMatchObject({
      source: "charge",
      type: "income",
      categoryId: category!.id,
      categoryName: "Cobranças avulsas",
      amountCents: 8000,
      chargeCounts: { paid: 1, pending: 1, overdue: 0 },
    });

    const summary = await financeService.getSummary("2026-09");
    expect(summary.incomePaidCents).toBe(3000);
    expect(summary.incomeForecastCents).toBe(5000);

    const byCategory = await financeService.getByCategory("2026-09");
    expect(byCategory.find((c) => c.categoryId === category!.id)).toMatchObject({ totalCents: 3000 });
  });

  it("cancelada sai do Financeiro", async () => {
    const student = await createStudent("Tom");
    const [c] = await billingService.createExtraCharge(extra(student));
    await billingService.cancelCharge(c.id);
    const rows = await financeService.listEntries({ competence: "2026-09" });
    expect(rows.find((r) => r.id === "charges:extra:2026-09")).toBeUndefined();
  });

  it("o % das mensalidades do professor ignora as avulsas pagas", async () => {
    const teacher = await createInstructor("Ana");
    const group = await createClass({ instructorId: teacher.id, slots: [{ weekday: 1, start: "08:00", end: "09:00" }] });
    const plan = await createPlan("monthly", 20000);
    const student = await enrollStudent({ plan, name: "Uma", startDate: "2026-09-01", strategy: "full_cycle" });
    await turmasService.enroll({ classGroupId: group.id, studentId: student.id });
    await billingService.createExtraCharge(extra(student, { description: "Exame de faixa", totalCents: 10000, firstDueDate: "2026-09-01" }));
    for (const c of store.charges) await billingService.markPaid(c.id, "pix");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "percent_of_memberships", percent: 40 }],
      startCompetence: "2026-09",
    });
    const payout = (await teacherPayService.listPayouts("2026-09")).find((p) => p.professionalId === teacher.id);
    expect(payout?.lines).toMatchObject([{ kind: "percent_of_memberships", baseCents: 20000, amountCents: 8000 }]);
  });
});
