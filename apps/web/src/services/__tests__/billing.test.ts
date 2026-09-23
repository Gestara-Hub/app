import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { ACADEMY_UNIT, chargesOf, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

const generate = async (...competences: string[]) => {
  for (const c of competences) await billingService.generateCharges(c);
};

describe("matriz das regras de cobrança (entrada 20/09, R$ 150, dia 10)", () => {
  beforeEach(() => resetAcademy());

  it("A. antecipado + proporcional", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "prepaid", strategy: "prorated" });
    await generate("2026-09", "2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-10-10 15000", "2026-11-10 15000"]);
  });

  it("B. antecipado + mês cheio", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "prepaid", strategy: "full_cycle" });
    await generate("2026-09", "2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-09-20 15000", "2026-10-20 15000", "2026-11-20 15000"]);
  });

  it("C. depois do uso + proporcional: nada em setembro, sem cobrança dupla", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "postpaid", strategy: "prorated" });
    await generate("2026-09", "2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-10-10 5500", "2026-11-10 15000"]);
  });

  it("D. depois do uso + mês cheio: nada em setembro", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "postpaid", strategy: "full_cycle" });
    await generate("2026-09", "2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-10-20 15000", "2026-11-20 15000"]);
  });

  it("o momento do pagamento do aluno é gravado também no proporcional", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "postpaid", strategy: "prorated" });
    expect(s.cyclePaymentTiming).toBe("postpaid");
  });
});

describe("geração em lote", () => {
  beforeEach(() => resetAcademy());

  it("é idempotente", async () => {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, startDate: "2026-09-20" });
    await generate("2026-10");
    const second = await billingService.generateCharges("2026-10");
    expect(second.created).toBe(0);
  });

  it("quinzenal não cobra a 2ª quinzena duas vezes no mês de entrada", async () => {
    const plan = await createPlan("biweekly", 8000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    await generate("2026-09", "2026-10");
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5867", "2026-10-10 8000", "2026-10-25 8000"]);
  });

  it("semanal cobra as semanas reais (4 ou 5 por mês)", async () => {
    const plan = await createPlan("weekly", 4500);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    await generate("2026-09", "2026-10", "2026-11");
    const byMonth = (m: string) => chargesOf(s.id).filter((c) => c.startsWith(m)).length;
    expect([byMonth("2026-09"), byMonth("2026-10"), byMonth("2026-11")]).toEqual([2, 4, 5]);
  });

  it("aluno inativo ou com assinatura pausada não gera", async () => {
    const plan = await createPlan("monthly", 15000);
    const inactive = await enrollStudent({ plan, startDate: "2026-09-01", name: "Inativo" });
    const paused = await enrollStudent({ plan, startDate: "2026-09-01", name: "Pausado" });
    await clientsService.remove(inactive.id);
    await clientsService.update(paused.id, { membershipStatus: "paused" });
    await generate("2026-10");
    expect(chargesOf(inactive.id).some((c) => c.startsWith("2026-10"))).toBe(false);
    expect(chargesOf(paused.id).some((c) => c.startsWith("2026-10"))).toBe(false);
  });

  it("carimba a unidade ativa nas mensalidades", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    await generate("2026-10");
    expect(store.charges.filter((c) => c.studentId === s.id).every((c) => c.unitId === ACADEMY_UNIT)).toBe(true);
  });
});

describe("status e operações", () => {
  beforeEach(() => resetAcademy());

  it("cobrança em aberto com vencimento passado é lida como atrasada", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" }); // vence 20/09, hoje 22/09
    const [charge] = await billingService.listCharges({ studentId: s.id });
    expect(store.charges.find((c) => c.id === charge.id)?.status).toBe("pending");
    expect(charge.status).toBe("overdue");
  });

  it("marcar pago guarda a forma de pagamento e desfazer volta a atrasado", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    const [charge] = await billingService.listCharges({ studentId: s.id });
    const paid = await billingService.markPaid(charge.id, "pix");
    expect(paid).toMatchObject({ status: "paid", method: "pix" });
    const undone = await billingService.markPending(charge.id);
    expect(undone).toMatchObject({ status: "overdue", method: undefined });
  });

  it("resetar a competência nunca apaga cobranças pagas", async () => {
    const plan = await createPlan("monthly", 15000);
    const a = await enrollStudent({ plan, startDate: "2026-09-20", name: "A" });
    await enrollStudent({ plan, startDate: "2026-09-20", name: "B" });
    const [paid] = await billingService.listCharges({ studentId: a.id });
    await billingService.markPaid(paid.id, "cash");
    const result = await billingService.clearCharges("2026-09");
    expect(result).toEqual({ deleted: 1, keptPaid: 1 });
    expect(store.charges.map((c) => c.id)).toEqual([paid.id]);
  });

  it("plano exige valor maior que zero", async () => {
    await expect(createPlan("monthly", 0)).rejects.toMatchObject({
      fields: [{ field: "priceCents", message: "Informe um valor maior que zero." }],
    });
  });

  it("operações financeiras entram na auditoria", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    const [charge] = await billingService.listCharges({ studentId: s.id });
    await billingService.markPaid(charge.id, "pix");
    await billingService.cancelCharge(charge.id);
    const summaries = store.auditLog.map((e) => e.summary);
    expect(summaries.some((t) => /^Ana Ribeiro criou o plano Plano monthly \(R\$\s150,00\)$/.test(t))).toBe(true);
    expect(summaries.some((t) => t.includes("registrou o pagamento da mensalidade"))).toBe(true);
    expect(summaries.some((t) => t.includes("cancelou a mensalidade"))).toBe(true);
  });
});

describe("ciclo de vida da assinatura", () => {
  beforeEach(() => resetAcademy());

  it("trocar de plano cancela as mensalidades abertas do antigo e mantém as pagas", async () => {
    const monthly = await createPlan("monthly", 15000, "Mensal");
    const biweekly = await createPlan("biweekly", 8000, "Quinzenal");
    const s = await enrollStudent({ plan: monthly, startDate: "2026-09-20" });
    const [sept] = await billingService.listCharges({ studentId: s.id });
    await billingService.markPaid(sept.id, "pix");
    await generate("2026-10", "2026-11");

    await clientsService.update(s.id, { planId: biweekly.id, planStartDate: "2026-10-01" });
    await generate("2026-10");

    const mine = store.charges.filter((c) => c.studentId === s.id);
    expect(mine.filter((c) => c.planId === monthly.id).map((c) => c.status).sort()).toEqual(["canceled", "canceled", "paid"]);
    // Antecipado: a 1a quinzena do plano novo vence no inicio da vigencia (01/10).
    expect(mine.filter((c) => c.planId === biweekly.id && c.status !== "canceled").map((c) => c.dueDate)).toEqual([
      "2026-10-01",
      "2026-10-25",
    ]);
  });

  it("inativar cancela períodos que não começaram e mantém a dívida do que foi usado", async () => {
    const plan = await createPlan("weekly", 4500);
    const s = await enrollStudent({ plan, startDate: "2026-09-13" });
    await generate("2026-09", "2026-10");
    await clientsService.remove(s.id);
    const mine = store.charges.filter((c) => c.studentId === s.id);
    const open = mine.filter((c) => c.status === "pending").map((c) => c.periodStart);
    expect(open.every((start) => (start ?? "") <= "2026-09-22")).toBe(true);
    expect(mine.some((c) => c.status === "canceled" && c.notes === "Cancelada na inativação do aluno")).toBe(true);
  });
});

describe("correções da auditoria da academia (cobrança)", () => {
  beforeEach(() => resetAcademy());

  const membershipsOf = (studentId: string) =>
    store.charges.filter((c) => c.studentId === studentId && c.kind === "membership");

  it("mensalidade cancelada não impede gerar o mesmo período de novo", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    await generate("2026-10");
    const oct = membershipsOf(s.id).find((c) => c.competence === "2026-10")!;
    await billingService.cancelCharge(oct.id);

    const again = await billingService.generateCharges("2026-10");
    expect(again.created).toBe(1);
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-10-10 15000"]);
  });

  it("cobrança existente que sobrepõe o período bloqueia uma nova", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    // Periodo de outra regra (15/10 a 14/11) sobrepõe outubro (01 a 31/10).
    const base = membershipsOf(s.id)[0];
    store.charges.push({
      ...base,
      id: "chg-overlap",
      competence: "2026-10",
      periodStart: "2026-10-15",
      periodEnd: "2026-11-14",
      dueDate: "2026-10-15",
      amountCents: 15000,
      status: "pending",
    });
    const result = await billingService.generateCharges("2026-10");
    expect(result.created).toBe(0);
  });

  it("resetar remove só mensalidades em aberto ou canceladas e o total bate com o do modal", async () => {
    const plan = await createPlan("monthly", 15000);
    const paid = await enrollStudent({ plan, startDate: "2026-09-20", name: "Pago" });
    const open = await enrollStudent({ plan, startDate: "2026-09-20", name: "Aberto" });
    const canceled = await enrollStudent({ plan, startDate: "2026-09-20", name: "Cancelado" });
    await billingService.markPaid(membershipsOf(paid.id)[0].id, "pix");
    await billingService.cancelCharge(membershipsOf(canceled.id)[0].id);
    // Aula avulsa na mesma competencia (nao e recriada pela geracao, entao fica).
    const dropin = { ...membershipsOf(open.id)[0], id: "chg-dropin", kind: "dropin" as const, planId: undefined };
    store.charges.push(dropin);

    // Mesma conta do modal "Resetar cobranças" (billing-view: mensalidades da competência que não são pagas).
    const modal = (await billingService.listCharges({ competence: "2026-09", kind: "membership" })).filter(
      (c) => c.status !== "paid",
    ).length;
    const result = await billingService.clearCharges("2026-09");

    expect(modal).toBe(2);
    expect(result).toEqual({ deleted: modal, keptPaid: 1 });
    expect(store.charges.map((c) => c.id).sort()).toEqual([membershipsOf(paid.id)[0].id, "chg-dropin"].sort());
  });

  it("reabrir aceita cancelada pelo usuário e recusa cancelada pelo sistema ou não cancelada", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    const [charge] = membershipsOf(s.id);

    await expect(billingService.reopenCharge(charge.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Só é possível reabrir uma cobrança cancelada.",
    });

    await billingService.cancelCharge(charge.id);
    expect(store.charges.find((c) => c.id === charge.id)?.canceledBy).toBe("user");
    const reopened = await billingService.reopenCharge(charge.id);
    expect(reopened.status).toBe("overdue"); // vencia 20/09, hoje 22/09
    expect(store.charges.find((c) => c.id === charge.id)).toMatchObject({ status: "pending", canceledBy: undefined });

    const stored = store.charges.find((c) => c.id === charge.id)!;
    stored.status = "canceled";
    stored.canceledBy = "system";
    await expect(billingService.reopenCharge(charge.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Esta cobrança foi cancelada automaticamente pelo sistema e não pode ser reaberta.",
    });
    expect(stored.status).toBe("canceled");
  });

  it("não muda a periodicidade de plano com alunos ativos", async () => {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, startDate: "2026-09-20" });
    await expect(billingService.updatePlan(plan.id, { period: "weekly" })).rejects.toMatchObject({
      fields: [{ field: "period" }],
    });
    expect(store.plans.find((p) => p.id === plan.id)?.period).toBe("monthly");
  });

  it("muda a periodicidade quando o plano não tem alunos ativos", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20" });
    await clientsService.remove(s.id);
    const updated = await billingService.updatePlan(plan.id, { period: "weekly" });
    expect(updated.period).toBe("weekly");
  });

  it("com alunos ativos, muda só nome e valor (mesma periodicidade reenviada é aceita)", async () => {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, startDate: "2026-09-20" });
    const updated = await billingService.updatePlan(plan.id, { name: "Mensal Plus", priceCents: 18000, period: "monthly" });
    expect(updated).toMatchObject({ name: "Mensal Plus", priceCents: 18000, period: "monthly" });
  });
});
