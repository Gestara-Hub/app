import type { Charge } from "@gestarahub/contracts";
import { chargesDueIn } from "@gestarahub/core/billing";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService, studentMembershipTerms } from "@/services/billingService";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { professionalsService } from "@/services/professionalsService";
import { servicesService } from "@/services/servicesService";
import { chargesOf, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

const generate = async (...competences: string[]) => {
  for (const c of competences) await billingService.generateCharges(c);
};
const membershipsOf = (studentId: string): Charge[] =>
  store.charges.filter((c) => c.studentId === studentId && c.kind === "membership");
const systemCanceled = (studentId: string) =>
  membershipsOf(studentId).filter((c) => c.status === "canceled" && c.canceledBy === "system");

/** Nenhum dia cobrado duas vezes entre as mensalidades que valem (não canceladas). */
function expectNoOverlap(studentId: string): void {
  const live = membershipsOf(studentId)
    .filter((c) => c.status !== "canceled")
    .sort((a, b) => (a.periodStart ?? "").localeCompare(b.periodStart ?? ""));
  for (let i = 1; i < live.length; i++) {
    expect(live[i].periodStart! > live[i - 1].periodEnd!).toBe(true);
  }
}

describe("troca da regra de cobrança do aluno", () => {
  beforeEach(() => resetAcademy());

  async function prepaidWithFuture() {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-20", timing: "prepaid", strategy: "prorated" });
    await generate("2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-10-10 15000", "2026-11-10 15000"]);
    return s;
  }

  it("mudar o momento do pagamento cancela as futuras em aberto e não cobra o mesmo período duas vezes", async () => {
    const s = await prepaidWithFuture();
    await clientsService.update(s.id, { cyclePaymentTiming: "postpaid" });

    expect(systemCanceled(s.id).map((c) => c.periodStart).sort()).toEqual(["2026-10-01", "2026-11-01"]);
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500"]);

    await generate("2026-10", "2026-11", "2026-12");
    // Depois do uso: 20-30/09 ja foi cobrado (antecipado) e nao volta em 10/10.
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-11-10 15000", "2026-12-10 15000"]);
    expectNoOverlap(s.id);
  });

  it("mudar o dia de vencimento cancela as futuras e regera no dia novo", async () => {
    const s = await prepaidWithFuture();
    await clientsService.update(s.id, { dueDay: 15 });
    expect(systemCanceled(s.id)).toHaveLength(2);
    await generate("2026-10", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-10-15 15000", "2026-11-15 15000"]);
    expectNoOverlap(s.id);
  });

  it("mudar a entrada no meio do período cancela as futuras sem cobrar dia repetido", async () => {
    const s = await prepaidWithFuture();
    await clientsService.update(s.id, { billingStrategy: "full_cycle" });
    expect(systemCanceled(s.id)).toHaveLength(2);
    await generate("2026-10", "2026-11");
    expect(membershipsOf(s.id).some((c) => c.status === "pending" && c.competence === "2026-10")).toBe(true);
    expectNoOverlap(s.id);
  });

  it("regravar a mesma regra efetiva não cancela nada", async () => {
    const s = await prepaidWithFuture();
    await clientsService.update(s.id, { cyclePaymentTiming: "prepaid", billingStrategy: "prorated", dueDay: 10 });
    // Sem regra propria o aluno herda a da academia (antecipado + proporcional): mesma regra.
    await clientsService.update(s.id, { cyclePaymentTiming: undefined, billingStrategy: undefined });
    expect(membershipsOf(s.id).filter((c) => c.status === "canceled")).toHaveLength(0);
    expect(chargesOf(s.id)).toEqual(["2026-09-20 5500", "2026-10-10 15000", "2026-11-10 15000"]);
  });
});

describe("inativação do aluno e o período em uso", () => {
  beforeEach(() => resetAcademy());

  it("depois do uso: inativar no meio do mês cobra o período em uso e cancela os futuros", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-08-01", timing: "postpaid", strategy: "prorated" });
    // Agosto vence 10/09 (1a cobranca); outubro vence 10/11. Setembro (vence 10/10) ainda nao foi gerado.
    await generate("2026-09", "2026-11");
    expect(chargesOf(s.id)).toEqual(["2026-09-10 15000", "2026-11-10 15000"]);

    await clientsService.remove(s.id);

    const student = store.clients.find((c) => c.id === s.id)!;
    const expected = chargesDueIn(studentMembershipTerms(student, plan), "2026-10").find(
      (c) => c.periodStart === "2026-09-01",
    )!;
    const september = membershipsOf(s.id).find((c) => c.periodStart === "2026-09-01")!;
    expect(september).toMatchObject({
      status: "pending",
      dueDate: expected.dueDate,
      amountCents: expected.amountCents,
      periodEnd: expected.periodEnd,
    });
    expect(chargesOf(s.id)).toEqual(["2026-09-10 15000", "2026-10-10 15000"]);
    expect(systemCanceled(s.id).map((c) => c.periodStart)).toEqual(["2026-10-01"]);
  });

  it("antecipado: inativar não cria cobrança nova", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01", timing: "prepaid" });
    await generate("2026-10");
    const before = store.charges.length;
    await clientsService.remove(s.id);
    expect(store.charges.length).toBe(before);
    expect(chargesOf(s.id)).toEqual(["2026-09-01 15000"]);
  });

  for (const membershipStatus of ["paused", "canceled"] as const) {
    it(`depois do uso com assinatura ${membershipStatus === "paused" ? "pausada" : "cancelada"}: inativar não cria cobrança`, async () => {
      const plan = await createPlan("monthly", 15000);
      const s = await enrollStudent({ plan, startDate: "2026-08-01", timing: "postpaid" });
      await clientsService.update(s.id, { membershipStatus });
      const before = store.charges.length;
      await clientsService.remove(s.id);
      expect(store.charges.length).toBe(before);
    });
  }
});

describe("editar sem enviar status mantém o status atual", () => {
  beforeEach(() => resetAcademy());

  it("aluno", async () => {
    const c = await clientsService.create({ name: "Aluno", phone: "11977770000", status: "active" });
    await clientsService.remove(c.id);
    const updated = await clientsService.update(c.id, { name: "Aluno Editado", phone: "11977770001" });
    expect(updated.status).toBe("inactive");
    const other = await clientsService.create({ name: "Ativo", phone: "11977770000", status: "active" });
    expect((await clientsService.update(other.id, { name: "Ativo 2" })).status).toBe("active");
  });

  it("profissional", async () => {
    const m = await categoriesService.create({ name: "Boxe" });
    const p = await professionalsService.create({
      name: "Instrutor",
      status: "active",
      workingHours: [],
      serviceIds: [],
      modalityIds: [m.id],
    });
    expect((await professionalsService.update(p.id, { name: "Instrutor 2" })).status).toBe("active");
    await professionalsService.remove(p.id);
    expect((await professionalsService.update(p.id, { name: "Instrutor 3" })).status).toBe("inactive");
  });

  it("serviço", async () => {
    const s = await servicesService.create({ name: "Avaliação", durationMinutes: 30, priceCents: 5000, status: "active" });
    expect((await servicesService.update(s.id, { name: "Avaliação física" })).status).toBe("active");
    await servicesService.remove(s.id);
    expect((await servicesService.update(s.id, { priceCents: 6000 })).status).toBe("inactive");
  });
});
