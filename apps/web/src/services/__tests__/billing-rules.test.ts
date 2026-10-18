import type { Charge, Client, Plan } from "@gestarahub/contracts";
import { firstCharge, resolveMembershipTerms } from "@gestarahub/core/billing";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService, membershipPeriodTaken } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { chargesOf, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

// Hoje = 22/09/2026 (src/test/setup.ts). Academia: antecipado + proporcional, vence dia 10.

const membershipsOf = (studentId: string): Charge[] =>
  store.charges.filter((c) => c.studentId === studentId && c.kind === "membership");
const byId = (id: string): Charge => store.charges.find((c) => c.id === id)!;
const summaries = () => store.auditLog.map((e) => e.summary);

const SEPTEMBER = { periodStart: "2026-09-01", periodEnd: "2026-09-30", competence: "2026-09", cycleIndex: 1 };
const OCTOBER = { periodStart: "2026-10-01", periodEnd: "2026-10-31", competence: "2026-10", cycleIndex: 1 };

/** Aluno com plano e sem 1a cobranca (o que existir vem da geracao). */
function planStudent(plan: Plan, startDate: string, name = "Aluno Plano"): Promise<Client> {
  return clientsService.create({
    name,
    phone: "11977770000",
    status: "active",
    membershipStatus: "active",
    planId: plan.id,
    planStartDate: startDate,
  });
}

/** 1a cobranca do plano novo, calculada pelo motor como o formulario faz. */
function initialChargeFor(plan: Plan, startDate: string) {
  const settings = store.organization.settings ?? {};
  const first = firstCharge(
    resolveMembershipTerms(
      { period: plan.period, planPriceCents: plan.priceCents, startDate, dueDay: settings.defaultDueDay },
      settings,
    ),
  );
  return {
    amountCents: first.amountCents,
    dueDate: first.dueDate,
    periodStart: first.periodStart,
    periodEnd: first.periodEnd,
    isProrated: first.isProrated,
    proratedDays: first.proratedDays,
  };
}

/** Troca o plano do aluno como o formulario: plano novo, inicio e 1a cobranca. */
function switchPlan(student: Client, plan: Plan, startDate: string): Promise<Client> {
  return clientsService.update(student.id, {
    planId: plan.id,
    planStartDate: startDate,
    initialCharge: initialChargeFor(plan, startDate),
  });
}

describe("geração automática de mensalidades na leitura", () => {
  beforeEach(() => resetAcademy());

  it("gera todo mês desde o início da vigência até o atual ao listar, sem auditoria", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-08-01");
    const auditBefore = store.auditLog.length;

    const list = await billingService.listCharges({ studentId: s.id });

    expect(list.map((c) => `${c.competence} ${c.dueDate} ${c.amountCents}`).sort()).toEqual([
      "2026-08 2026-08-01 15000",
      "2026-09 2026-09-10 15000",
    ]);
    // Agosto nasce mesmo sem ninguem abrir o mes: o atraso nao depende da navegacao.
    expect(chargesOf(s.id)).toEqual(["2026-08-01 15000", "2026-09-10 15000"]);
    expect(store.auditLog.length).toBe(auditBefore);
  });

  it("meses pulados entram todos, e o atraso é o mesmo em qualquer tela", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-06-01");
    await billingService.listCharges({ competence: "2026-09" });
    expect(chargesOf(s.id)).toEqual([
      "2026-06-01 15000",
      "2026-07-10 15000",
      "2026-08-10 15000",
      "2026-09-10 15000",
    ]);
  });

  it("é idempotente entre leituras e com a geração manual", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-08-01");
    await billingService.listCharges();
    await billingService.listCharges();
    await billingService.listCharges({ competence: "2026-09" });
    expect(chargesOf(s.id)).toEqual(["2026-08-01 15000", "2026-09-10 15000"]);
    expect((await billingService.generateCharges("2026-09")).created).toBe(0);
  });

  it("mês futuro não é gerado na leitura, só pela geração", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-08-01");
    const october = await billingService.listCharges({ competence: "2026-10" });
    expect(october).toEqual([]);
    expect(membershipsOf(s.id).some((c) => c.competence === "2026-10")).toBe(false);

    expect((await billingService.generateCharges("2026-10")).created).toBe(1);
    expect(chargesOf(s.id)).toEqual(["2026-08-01 15000", "2026-09-10 15000", "2026-10-10 15000"]);
  });

  it("mês passado consultado é gerado junto com o atual", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-08-01");
    const august = await billingService.listCharges({ competence: "2026-08" });
    expect(august.map((c) => `${c.dueDate} ${c.amountCents} ${c.status}`)).toEqual(["2026-08-01 15000 overdue"]);
    expect(chargesOf(s.id)).toEqual(["2026-08-01 15000", "2026-09-10 15000"]);
  });

  it("cancelada pelo usuário não volta na leitura; cancelada pelo sistema libera o período", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await planStudent(plan, "2026-08-01");
    const sept = (await billingService.listCharges({ studentId: s.id })).find((c) => c.competence === "2026-09")!;
    await billingService.cancelCharge(sept.id);

    await billingService.listCharges({ studentId: s.id });
    expect(membershipsOf(s.id)).toHaveLength(2);

    byId(sept.id).canceledBy = "system";
    await billingService.listCharges({ studentId: s.id });
    expect(chargesOf(s.id)).toEqual(["2026-08-01 15000", "2026-09-10 15000"]);
    expect(membershipsOf(s.id)).toHaveLength(3);
  });
});

describe("período ocupado em qualquer plano (troca de plano)", () => {
  let planA: Plan;
  let planB: Plan;

  beforeEach(async () => {
    resetAcademy();
    planA = await createPlan("monthly", 15000, "Pro");
    planB = await createPlan("monthly", 18000, "Plus");
  });

  const septOf = (studentId: string, planId: string) =>
    membershipsOf(studentId).find((c) => c.planId === planId && c.periodStart === "2026-09-01");

  it("mês pago no plano A ocupa o período para o plano B (inclusive sobreposição parcial)", async () => {
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    await billingService.markPaid(septOf(s.id, planA.id)!.id, "pix");

    expect(membershipPeriodTaken(s.id, planB.id, SEPTEMBER)).toBe(true);
    expect(
      membershipPeriodTaken(s.id, planB.id, { ...SEPTEMBER, periodStart: "2026-09-15", periodEnd: "2026-10-14" }),
    ).toBe(true);
    expect(membershipPeriodTaken(s.id, planB.id, OCTOBER)).toBe(false);
  });

  it("trocar para B com o mês pago em A não cobra o mês de novo; B começa no mês seguinte", async () => {
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    const paid = septOf(s.id, planA.id)!;
    await billingService.markPaid(paid.id, "pix");

    await switchPlan(s, planB, "2026-09-01");
    await billingService.listCharges({ studentId: s.id });
    expect(membershipsOf(s.id).filter((c) => c.planId === planB.id)).toEqual([]);
    expect(byId(paid.id).status).toBe("paid");

    await billingService.generateCharges("2026-10");
    expect(chargesOf(s.id)).toEqual(["2026-09-01 15000", "2026-10-10 18000"]);
    expect(membershipsOf(s.id).find((c) => c.competence === "2026-10")?.planId).toBe(planB.id);
  });

  it("plano semanal novo pula as semanas que sobrepõem o mês pago", async () => {
    const weekly = await createPlan("weekly", 4500, "Semanal");
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    await billingService.markPaid(septOf(s.id, planA.id)!.id, "pix");

    await switchPlan(s, weekly, "2026-09-01");
    await billingService.listCharges({ studentId: s.id });
    await billingService.generateCharges("2026-10");

    const weeks = membershipsOf(s.id).filter((c) => c.planId === weekly.id && c.status !== "canceled");
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((c) => (c.periodStart ?? "") > "2026-09-30")).toBe(true);
  });

  it("cancelada pelo usuário só ocupa o período no mesmo plano", async () => {
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    const wrong = septOf(s.id, planA.id)!;
    await billingService.cancelCharge(wrong.id, "Plano errado");

    expect(membershipPeriodTaken(s.id, planA.id, SEPTEMBER)).toBe(true);
    expect(membershipPeriodTaken(s.id, planB.id, SEPTEMBER)).toBe(false);

    await switchPlan(s, planB, "2026-09-01");
    expect(septOf(s.id, planB.id)).toMatchObject({ status: "pending", amountCents: 18000 });
    expect(byId(wrong.id)).toMatchObject({ status: "canceled", canceledBy: "user", cancelReason: "Plano errado" });
  });

  it("cancelada pelo sistema libera o período, inclusive no mesmo plano", async () => {
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    const open = septOf(s.id, planA.id)!;

    await clientsService.update(s.id, { planId: planB.id, planStartDate: "2026-09-01" });
    expect(byId(open.id)).toMatchObject({ status: "canceled", canceledBy: "system" });
    expect(membershipPeriodTaken(s.id, planA.id, SEPTEMBER)).toBe(false);
    expect(membershipPeriodTaken(s.id, planB.id, SEPTEMBER)).toBe(false);

    // Sem 1a cobranca no payload: a leitura gera setembro no plano novo.
    await billingService.listCharges({ studentId: s.id });
    expect(septOf(s.id, planB.id)).toMatchObject({ status: "pending", amountCents: 18000 });
    expect(chargesOf(s.id)).toEqual(["2026-09-01 18000"]);
  });

  it("reabrir é recusado (409) quando outra mensalidade ativa cobre o período", async () => {
    const s = await enrollStudent({ plan: planA, startDate: "2026-09-01" });
    const wrong = septOf(s.id, planA.id)!;
    await billingService.cancelCharge(wrong.id, "Plano errado");
    await switchPlan(s, planB, "2026-09-01");
    const replacement = septOf(s.id, planB.id)!;

    await expect(billingService.reopenCharge(wrong.id)).rejects.toMatchObject({
      code: "VALIDATION",
      httpStatus: 409,
      message: "Já existe outra mensalidade para este período. Cancele-a antes de reabrir esta.",
    });
    expect(byId(wrong.id).status).toBe("canceled");

    // Cancelada a outra, a reabertura passa.
    await billingService.cancelCharge(replacement.id);
    const reopened = await billingService.reopenCharge(wrong.id);
    expect(reopened.status).toBe("overdue"); // vencia 01/09
  });
});

describe("motivo do cancelamento", () => {
  beforeEach(() => resetAcademy());

  async function openCharge() {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01", name: "Bruno" });
    return membershipsOf(s.id)[0];
  }

  it("guarda o motivo (sem espaços) e a auditoria termina com ele", async () => {
    const charge = await openCharge();
    const view = await billingService.cancelCharge(charge.id, "  Cobrança duplicada  ");
    expect(view).toMatchObject({ status: "canceled", cancelReason: "Cobrança duplicada" });
    expect(byId(charge.id)).toMatchObject({ canceledBy: "user", cancelReason: "Cobrança duplicada" });
    const last = summaries().at(-1)!;
    expect(last).toMatch(/^Ana Ribeiro cancelou a mensalidade de Bruno \(.+\): Cobrança duplicada$/);
  });

  it("sem motivo (ou em branco) não grava motivo nem sufixo na auditoria", async () => {
    const charge = await openCharge();
    await billingService.cancelCharge(charge.id, "   ");
    expect(byId(charge.id).cancelReason).toBeUndefined();
    expect(summaries().at(-1)).toMatch(/^Ana Ribeiro cancelou a mensalidade de Bruno \(R\$\s150,00, vence 01\/09\/2026\)$/);
  });

  it("reabrir limpa o motivo", async () => {
    const charge = await openCharge();
    await billingService.cancelCharge(charge.id, "Aluno desistiu");
    const reopened = await billingService.reopenCharge(charge.id);
    expect(reopened.cancelReason).toBeUndefined();
    expect(byId(charge.id)).toMatchObject({ status: "pending", cancelReason: undefined, canceledBy: undefined });
    expect(summaries().at(-1)).toContain("reabriu a mensalidade de Bruno");
  });
});

describe("cobranças substituídas", () => {
  let plan: Plan;
  let student: Client;

  beforeEach(async () => {
    resetAcademy();
    plan = await createPlan("monthly", 15000, "Mensal");
    student = await enrollStudent({ plan, startDate: "2026-09-01" });
    await billingService.generateCharges("2026-10");
  });

  const sept = () => membershipsOf(student.id).find((c) => c.periodStart === "2026-09-01" && c.planId === plan.id)!;
  const oct = () => membershipsOf(student.id).find((c) => c.periodStart === "2026-10-01" && c.planId === plan.id)!;

  it("troca de plano marca a futura em aberto como substituída", async () => {
    const other = await createPlan("monthly", 18000, "Plus");
    await clientsService.update(student.id, { planId: other.id, planStartDate: "2026-10-01" });
    expect(oct()).toMatchObject({
      status: "canceled",
      canceledBy: "system",
      replaced: true,
      notes: "Substituída pela troca de plano",
    });
    expect(sept()).toMatchObject({ status: "pending" });
    expect(sept().replaced).toBeUndefined();
  });

  it("troca da data de início no mesmo plano marca como substituída", async () => {
    await clientsService.update(student.id, { planStartDate: "2026-10-01" });
    expect(oct()).toMatchObject({ status: "canceled", replaced: true, notes: "Substituída pela troca de plano" });
  });

  it("troca do desconto marca como substituída e a geração recria pelo valor novo", async () => {
    await clientsService.update(student.id, { discount: { type: "percentage", value: 10 } });
    expect(oct()).toMatchObject({
      status: "canceled",
      replaced: true,
      notes: "Substituída pela troca da regra de cobrança",
    });
    expect(sept().status).toBe("pending"); // periodo ja iniciado fica
    await billingService.generateCharges("2026-10");
    expect(chargesOf(student.id)).toEqual(["2026-09-01 15000", "2026-10-10 13500"]);
  });

  it("troca da regra (dia de vencimento) marca como substituída", async () => {
    await clientsService.update(student.id, { dueDay: 15 });
    expect(oct()).toMatchObject({ status: "canceled", replaced: true });
  });

  it("troca da bolsa (plano reenviado como no formulário) marca como substituída", async () => {
    await clientsService.update(student.id, {
      planId: plan.id,
      discount: { type: "percentage", value: 50, scholarship: true },
    });
    expect(oct()).toMatchObject({ status: "canceled", replaced: true });
  });

  it("substituída não pode ser reaberta", async () => {
    await clientsService.update(student.id, { dueDay: 15 });
    await expect(billingService.reopenCharge(oct().id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("inativar cancela as futuras sem marcar substituída e mantém as já iniciadas", async () => {
    await clientsService.remove(student.id);
    expect(oct()).toMatchObject({
      status: "canceled",
      canceledBy: "system",
      notes: "Cancelada na inativação do aluno",
    });
    expect(oct().replaced).toBeUndefined();
    expect(sept()).toMatchObject({ status: "pending" });
    expect(sept().canceledBy).toBeUndefined();
  });

  it("inativar cancelando o que está em aberto: já iniciadas viram canceladas pelo usuário e reabrem", async () => {
    await clientsService.remove(student.id, { cancelOpenCharges: true });
    expect(sept()).toMatchObject({ status: "canceled", canceledBy: "user", cancelReason: "Aluno inativado" });
    expect(sept().replaced).toBeUndefined();
    expect(oct()).toMatchObject({ status: "canceled", canceledBy: "system" });
    expect(oct().replaced).toBeUndefined();
    expect(summaries().at(-1)).toContain("cancelou também 1 mensalidade em aberto");

    const reopened = await billingService.reopenCharge(sept().id);
    expect(reopened.status).toBe("overdue");
  });

  it("paga não é substituída nem cancelada na troca de plano", async () => {
    await billingService.markPaid(oct().id, "pix");
    const other = await createPlan("monthly", 18000, "Plus");
    await clientsService.update(student.id, { planId: other.id, planStartDate: "2026-10-01" });
    expect(oct()).toMatchObject({ status: "paid" });
    expect(oct().replaced).toBeUndefined();
  });
});
