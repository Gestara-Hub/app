import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { clientsService } from "@/services/clients";
import { createPlan, resetAcademy } from "@/test/academy";

/**
 * 1a mensalidade do cadastro (revisao de valores de 30/10/2026): o periodo e o
 * do motor de cobranca; o valor ajustado vale so para quem tem billing:manage.
 */

const base = (planId: string) => ({
  name: "Ana",
  phone: "11977770000",
  status: "active" as const,
  planId,
  planStartDate: "2026-09-20",
  billingStrategy: "prorated" as const,
  cyclePaymentTiming: "prepaid" as const,
  dueDay: 10,
});

const firstOf = (studentId: string) => store.charges.find((c) => c.studentId === studentId && c.kind === "membership")!;

beforeEach(() => resetAcademy());

describe("1ª mensalidade do cadastro", () => {
  it("atendente não ajusta o valor: fica o do motor", async () => {
    setCurrentActor({ userId: "usr-atendente", name: "Atendente", profile: "attendant" });
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      initialCharge: { amountCents: 100, dueDate: "2026-09-20", periodStart: "2026-09-20", periodEnd: "2026-10-09", isProrated: true, proratedDays: 20 },
    });
    expect(firstOf(c.id).amountCents).toBeGreaterThan(100);
  });

  it("dono ajusta o valor; período fora do motor vira o do motor", async () => {
    setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      initialCharge: { amountCents: 9000, dueDate: "2026-01-05", periodStart: "2026-01-01", periodEnd: "2027-12-31" },
    });
    const first = firstOf(c.id);
    expect(first.amountCents).toBe(9000);
    expect(first.periodStart).toBe("2026-09-20");
    expect(first.periodEnd).not.toBe("2027-12-31");
  });
});
