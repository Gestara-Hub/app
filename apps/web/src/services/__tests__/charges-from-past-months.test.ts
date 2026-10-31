import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { autoGenerateMembershipCharges } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { createPlan, resetAcademy } from "@/test/academy";

/**
 * Aluno antigo cadastrado agora (decisao de 31/10/2026, pergunta "Cobrar os
 * meses desde o início?"): com `chargesFrom`, o que vence antes dela nao e
 * cobrado, nem no cadastro nem na geracao em lote. Hoje nos testes: 22/09/2026.
 */

const base = (planId: string) => ({
  name: "Ana",
  phone: "11977770000",
  status: "active" as const,
  planId,
  planStartDate: "2026-03-20",
  billingStrategy: "prorated" as const,
  cyclePaymentTiming: "prepaid" as const,
  dueDay: 10,
});

const membershipsOf = (studentId: string) =>
  store.charges
    .filter((c) => c.studentId === studentId && c.kind === "membership")
    .map((c) => c.dueDate)
    .sort();

beforeEach(() => {
  resetAcademy();
  setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
});

describe("cadastro de aluno antigo: meses passados", () => {
  it("\"A partir deste mês\": só a mensalidade de setembro, nada antes", async () => {
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      chargesFrom: "2026-09-01",
      initialCharge: { amountCents: 15000, dueDate: "2026-09-10", periodStart: "2026-09-10", periodEnd: "2026-10-09" },
    });
    autoGenerateMembershipCharges();
    expect(membershipsOf(c.id)).toEqual(["2026-09-10"]);
    expect(store.clients.find((x) => x.id === c.id)?.chargesFrom).toBe("2026-09-01");
  });

  it("\"Desde o início\": cobra todos os meses desde março", async () => {
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      initialCharge: { amountCents: 6290, dueDate: "2026-03-20", periodStart: "2026-03-20", periodEnd: "2026-03-31", isProrated: true, proratedDays: 12 },
    });
    autoGenerateMembershipCharges();
    expect(membershipsOf(c.id)).toEqual(["2026-03-20", "2026-04-10", "2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"]);
  });

  it("data futura ou antes do início é ignorada pelo servidor", async () => {
    const plan = await createPlan("monthly", 15000);
    const future = await clientsService.create({ ...base(plan.id), chargesFrom: "2026-12-01" });
    const beforeStart = await clientsService.create({ ...base(plan.id), name: "Bia", chargesFrom: "2026-01-01" });
    expect(store.clients.find((x) => x.id === future.id)?.chargesFrom).toBeUndefined();
    expect(store.clients.find((x) => x.id === beforeStart.id)?.chargesFrom).toBeUndefined();
  });

  it("editar o aluno não muda a data: a escolha é só do cadastro", async () => {
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({ ...base(plan.id), chargesFrom: "2026-09-01" });
    await clientsService.update(c.id, { chargesFrom: "2026-03-20", notes: "Faixa azul" });
    expect(store.clients.find((x) => x.id === c.id)?.chargesFrom).toBe("2026-09-01");
  });
});
