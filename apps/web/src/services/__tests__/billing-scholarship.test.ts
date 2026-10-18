import type { Charge, Plan, StudentDiscount } from "@gestarahub/contracts";
import { firstCharge, resolveMembershipTerms } from "@gestarahub/core/billing";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService, scholarshipChargeFields } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { turmasService } from "@/services/turmasService";
import { chargesOf, createClass, createInstructor, createPlan, resetAcademy } from "@/test/academy";

// Hoje = 22/09/2026 (src/test/setup.ts). Academia: antecipado + proporcional, vence dia 10.

const INTEGRAL: StudentDiscount = { type: "percentage", value: 100, scholarship: true, reason: "Atleta" };
const HALF: StudentDiscount = { type: "percentage", value: 50, scholarship: true };

const membershipsOf = (studentId: string): Charge[] =>
  store.charges
    .filter((c) => c.studentId === studentId && c.kind === "membership")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const live = (studentId: string) => membershipsOf(studentId).filter((c) => c.status !== "canceled");
const byCompetence = (studentId: string, competence: string) =>
  live(studentId).filter((c) => c.competence === competence);

/** Cadastra com plano e desconto/bolsa como o formulario: 1a cobranca pelo motor, ja com o desconto. */
async function enrollWithDiscount(plan: Plan, startDate: string, discount: StudentDiscount, name = "Bolsista") {
  const settings = store.organization.settings ?? {};
  const first = firstCharge(
    resolveMembershipTerms(
      { period: plan.period, planPriceCents: plan.priceCents, startDate, dueDay: settings.defaultDueDay, discount },
      settings,
    ),
  );
  return clientsService.create({
    name,
    phone: "11977770000",
    status: "active",
    membershipStatus: "active",
    planId: plan.id,
    planStartDate: startDate,
    dueDay: settings.defaultDueDay,
    discount,
    initialCharge: {
      amountCents: first.amountCents,
      dueDate: first.dueDate,
      periodStart: first.periodStart,
      periodEnd: first.periodEnd,
      isProrated: first.isProrated,
      proratedDays: first.proratedDays,
    },
  });
}

/** Bolsista integral sem plano (o formulario envia o inicio e a regra mesmo sem plano). */
function planlessScholar(startDate: string, discount: StudentDiscount = INTEGRAL, name = "Bolsista sem plano") {
  return clientsService.create({
    name,
    phone: "11977770000",
    status: "active",
    membershipStatus: "active",
    planStartDate: startDate,
    discount,
  });
}

describe("scholarshipChargeFields", () => {
  const planned = (amountCents: number, listAmountCents: number, discountApplied = true) => ({
    amountCents,
    listAmountCents,
    discountApplied,
  });

  it("integral: isento, 100% e valor de referência", () => {
    expect(scholarshipChargeFields({ discount: INTEGRAL }, planned(0, 15000))).toEqual({
      status: "waived",
      scholarshipPercent: 100,
      listAmountCents: 15000,
    });
  });

  it("parcial: pendente com o percentual", () => {
    expect(scholarshipChargeFields({ discount: HALF }, planned(7500, 15000))).toEqual({
      status: "pending",
      scholarshipPercent: 50,
      listAmountCents: 15000,
    });
  });

  it("bolsa por valor a pagar (valor fixo) deriva o percentual", () => {
    const fixed: StudentDiscount = { type: "fixed", value: 9000, scholarship: true };
    expect(scholarshipChargeFields({ discount: fixed }, planned(9000, 18000))).toEqual({
      status: "pending",
      scholarshipPercent: 50,
      listAmountCents: 18000,
    });
  });

  it("desconto comum, bolsa fora da validade ou aluno sem desconto: só pendente", () => {
    expect(scholarshipChargeFields({ discount: { type: "percentage", value: 10 } }, planned(13500, 15000))).toEqual({
      status: "pending",
    });
    expect(scholarshipChargeFields({ discount: INTEGRAL }, planned(15000, 15000, false))).toEqual({ status: "pending" });
    expect(scholarshipChargeFields(undefined, planned(15000, 15000, false))).toEqual({ status: "pending" });
  });
});

describe("bolsa integral com plano", () => {
  let plan: Plan;

  beforeEach(async () => {
    resetAcademy();
    plan = await createPlan("monthly", 15000, "Mensal");
  });

  it("1ª mensalidade nasce isenta (R$ 0) e não fica atrasada", async () => {
    const s = await enrollWithDiscount(plan, "2026-09-01", INTEGRAL);
    expect(membershipsOf(s.id)).toHaveLength(1);
    expect(membershipsOf(s.id)[0]).toMatchObject({
      status: "waived",
      amountCents: 0,
      scholarshipPercent: 100,
      listAmountCents: 15000,
      planId: plan.id,
    });
    const [view] = await billingService.listCharges({ studentId: s.id });
    expect(view.status).toBe("waived"); // vencia 01/09, hoje 22/09
  });

  it("a geração cria as próximas isentas", async () => {
    const s = await enrollWithDiscount(plan, "2026-09-01", INTEGRAL);
    await billingService.generateCharges("2026-10");
    expect(byCompetence(s.id, "2026-10")).toEqual([
      expect.objectContaining({ status: "waived", amountCents: 0, scholarshipPercent: 100, listAmountCents: 15000 }),
    ]);
  });

  it("pagar, desfazer e cancelar isenta são recusados (409)", async () => {
    const s = await enrollWithDiscount(plan, "2026-09-01", INTEGRAL);
    const [charge] = membershipsOf(s.id);
    const refused = {
      code: "VALIDATION",
      httpStatus: 409,
      message: "Mensalidade isenta. Para cobrar, ajuste a bolsa ou o desconto no cadastro do aluno.",
    };
    await expect(billingService.markPaid(charge.id, "pix")).rejects.toMatchObject(refused);
    await expect(billingService.markPending(charge.id)).rejects.toMatchObject(refused);
    await expect(billingService.cancelCharge(charge.id, "Teste")).rejects.toMatchObject(refused);
    const stored = store.charges.find((c) => c.id === charge.id)!;
    expect(stored.status).toBe("waived");
    expect(stored.cancelReason).toBeUndefined();
  });

  it("depois do 'Válida até' volta ao valor cheio do plano", async () => {
    const s = await enrollWithDiscount(plan, "2026-09-01", { ...INTEGRAL, validUntil: "2026-09-30" });
    await billingService.generateCharges("2026-10");
    const [october] = byCompetence(s.id, "2026-10");
    expect(october).toMatchObject({ status: "pending", amountCents: 15000 });
    expect(october.scholarshipPercent).toBeUndefined();
    expect(membershipsOf(s.id)[0].status).toBe("waived");
  });

  it("inativar cancela também as isentas futuras", async () => {
    const s = await enrollWithDiscount(plan, "2026-09-01", INTEGRAL);
    await billingService.generateCharges("2026-10");
    await clientsService.remove(s.id);
    const [sept, oct] = membershipsOf(s.id);
    expect(sept.status).toBe("waived");
    expect(oct).toMatchObject({ status: "canceled", canceledBy: "system" });
  });
});

describe("bolsa parcial", () => {
  beforeEach(() => resetAcademy());

  it("por percentual: mensalidade pendente com valor reduzido e o percentual", async () => {
    const plan = await createPlan("monthly", 18000);
    const s = await enrollWithDiscount(plan, "2026-09-01", HALF);
    await billingService.generateCharges("2026-10");
    expect(live(s.id).map((c) => [c.dueDate, c.amountCents, c.status, c.scholarshipPercent, c.listAmountCents])).toEqual([
      ["2026-09-01", 9000, "pending", 50, 18000],
      ["2026-10-10", 9000, "pending", 50, 18000],
    ]);
  });

  it("por valor a pagar (fixo) deriva o percentual, inclusive no proporcional", async () => {
    const plan = await createPlan("monthly", 18000);
    const fixed: StudentDiscount = { type: "fixed", value: 9000, scholarship: true };
    const s = await enrollWithDiscount(plan, "2026-09-20", fixed);
    await billingService.generateCharges("2026-10");
    // 20 a 30/09 = 11 de 30 dias: 6600 cheio, 3300 com bolsa.
    expect(live(s.id).map((c) => [c.amountCents, c.scholarshipPercent, c.listAmountCents])).toEqual([
      [3300, 50, 6600],
      [9000, 50, 18000],
    ]);
  });

  it("sem plano é recusada pela validação", async () => {
    const before = store.clients.length;
    const expected = { code: "VALIDATION", fields: [{ field: "planId", message: "Bolsa parcial precisa de um plano." }] };
    await expect(planlessScholar("2026-09-01", HALF)).rejects.toMatchObject(expected);
    await expect(
      planlessScholar("2026-09-01", { type: "fixed", value: 9000, scholarship: true }),
    ).rejects.toMatchObject(expected);
    expect(store.clients.length).toBe(before);
  });

  it("na edicao, vale o plano ja gravado quando o payload nao traz planId", async () => {
    const plan = await createPlan("monthly", 18000);
    const s = await enrollWithDiscount(plan, "2026-09-01", { type: "percentage", value: 10 });
    await expect(clientsService.update(s.id, { discount: HALF })).resolves.toMatchObject({ planId: plan.id });

    // Tirar o plano de quem tem bolsa parcial gravada continua recusado.
    await expect(clientsService.update(s.id, { planId: undefined })).rejects.toMatchObject({
      fields: [{ field: "planId", message: "Bolsa parcial precisa de um plano." }],
    });
  });

  it("trocar integral por parcial substitui a isenta futura e a geração cobra o valor novo", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollWithDiscount(plan, "2026-09-01", INTEGRAL);
    await billingService.generateCharges("2026-10");
    const waivedOct = byCompetence(s.id, "2026-10")[0];

    await clientsService.update(s.id, { planId: plan.id, discount: HALF });
    expect(store.charges.find((c) => c.id === waivedOct.id)).toMatchObject({
      status: "canceled",
      canceledBy: "system",
      replaced: true,
    });
    await billingService.generateCharges("2026-10");
    expect(byCompetence(s.id, "2026-10")).toEqual([
      expect.objectContaining({ status: "pending", amountCents: 7500, scholarshipPercent: 50 }),
    ]);
  });
});

describe("bolsista integral sem plano", () => {
  beforeEach(() => resetAcademy());

  it("cadastro cria a isenta do mês, sem plano e sem valor de referência", async () => {
    const s = await planlessScholar("2026-09-01");
    expect(membershipsOf(s.id)).toHaveLength(1);
    const [charge] = membershipsOf(s.id);
    expect(charge).toMatchObject({
      status: "waived",
      amountCents: 0,
      scholarshipPercent: 100,
      competence: "2026-09",
      dueDate: "2026-09-01",
    });
    expect(charge.planId).toBeUndefined();
    expect(charge.listAmountCents).toBeUndefined();

    const [view] = await billingService.listCharges({ studentId: s.id });
    expect(view).toMatchObject({ status: "waived", planName: "Bolsa integral", planPeriod: "monthly" });
  });

  it("com início em mês passado cria o mês de início e o atual", async () => {
    const s = await planlessScholar("2026-08-01");
    expect(membershipsOf(s.id).map((c) => `${c.competence} ${c.status}`)).toEqual(["2026-08 waived", "2026-09 waived"]);
  });

  it("isenta todo mês e é idempotente", async () => {
    const s = await planlessScholar("2026-09-01");
    await billingService.listCharges();
    await billingService.listCharges({ studentId: s.id });
    expect((await billingService.generateCharges("2026-09")).created).toBe(0);
    expect((await billingService.generateCharges("2026-10")).created).toBe(1);
    expect((await billingService.generateCharges("2026-10")).created).toBe(0);
    expect((await billingService.generateCharges("2026-11")).created).toBe(1);
    expect(chargesOf(s.id)).toEqual(["2026-09-01 0", "2026-10-10 0", "2026-11-10 0"]);
    expect(live(s.id).every((c) => c.status === "waived" && !c.planId)).toBe(true);
  });

  it("para depois do 'Válida até'", async () => {
    const s = await planlessScholar("2026-09-01", { ...INTEGRAL, validUntil: "2026-10-31" });
    expect((await billingService.generateCharges("2026-10")).created).toBe(1);
    expect((await billingService.generateCharges("2026-11")).created).toBe(0);
    expect((await billingService.generateCharges("2026-12")).created).toBe(0);
    expect(chargesOf(s.id)).toEqual(["2026-09-01 0", "2026-10-10 0"]);
  });

  it("não herda o plano da turma (regra legada)", async () => {
    const plan = await createPlan("monthly", 15000);
    const instructor = await createInstructor("Mestre");
    const group = await createClass({ instructorId: instructor.id, slots: [{ weekday: 1, start: "19:00", end: "20:00" }] });
    store.classGroups.find((g) => g.id === group.id)!.planId = plan.id;
    const s = await planlessScholar("2026-09-01");
    await turmasService.enroll({ classGroupId: group.id, studentId: s.id });

    await billingService.listCharges();
    await billingService.generateCharges("2026-10");
    expect(membershipsOf(s.id).some((c) => c.planId === plan.id)).toBe(false);
    expect(live(s.id).map((c) => c.status)).toEqual(["waived", "waived"]);
  });

  it("sair da bolsa substitui as isentas futuras e para de gerar", async () => {
    const s = await planlessScholar("2026-09-01");
    await billingService.generateCharges("2026-10");
    const [sept, oct] = membershipsOf(s.id);

    await clientsService.update(s.id, { discount: undefined });
    expect(store.charges.find((c) => c.id === oct.id)).toMatchObject({
      status: "canceled",
      canceledBy: "system",
      replaced: true,
      notes: "Substituída pela troca da bolsa",
    });
    // Periodo ja iniciado (01/09) fica isento.
    expect(store.charges.find((c) => c.id === sept.id)?.status).toBe("waived");
    expect((await billingService.generateCharges("2026-11")).created).toBe(0);
  });

  it("trocar a validade substitui as futuras e a geração recria pela regra nova", async () => {
    const s = await planlessScholar("2026-09-01");
    await billingService.generateCharges("2026-10");
    const oldOct = byCompetence(s.id, "2026-10")[0];

    await clientsService.update(s.id, { discount: { ...INTEGRAL, validUntil: "2026-10-31" } });
    expect(store.charges.find((c) => c.id === oldOct.id)).toMatchObject({ status: "canceled", replaced: true });

    expect((await billingService.generateCharges("2026-10")).created).toBe(1);
    expect((await billingService.generateCharges("2026-11")).created).toBe(0);
    expect(byCompetence(s.id, "2026-10")).toEqual([expect.objectContaining({ status: "waived", amountCents: 0 })]);
  });

  it("assinatura pausada não gera isenta", async () => {
    const s = await planlessScholar("2026-09-01");
    await clientsService.update(s.id, { membershipStatus: "paused" });
    expect((await billingService.generateCharges("2026-10")).created).toBe(0);
    expect(membershipsOf(s.id)).toHaveLength(1);
  });
});
