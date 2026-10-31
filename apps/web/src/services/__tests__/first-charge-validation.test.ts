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

  it("dono ajusta o valor do período do motor; o fim e o proporcional são sempre os do motor", async () => {
    setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      // Periodo certo, mas fim forjado: travaria as cobrancas seguintes (achado V3).
      initialCharge: { amountCents: 9000, dueDate: "2026-09-20", periodStart: "2026-09-20", periodEnd: "2030-12-31", isProrated: false },
    });
    const first = firstOf(c.id);
    expect(first.amountCents).toBe(9000);
    expect(first.periodStart).toBe("2026-09-20");
    expect(first.periodEnd).toBe("2026-09-30");
    expect(first.isProrated).toBe(true);
  });

  it("período fora do motor: vale o período e o valor do motor, mesmo para o dono (achado V1)", async () => {
    setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
    const plan = await createPlan("monthly", 15000);
    const c = await clientsService.create({
      ...base(plan.id),
      initialCharge: { amountCents: 9000, dueDate: "2026-01-05", periodStart: "2026-01-01", periodEnd: "2027-12-31" },
    });
    const first = firstOf(c.id);
    expect(first.periodStart).toBe("2026-09-20");
    expect(first.periodEnd).toBe("2026-09-30");
    expect(first.amountCents).not.toBe(9000);
  });
});

describe("desconto, bolsa e preço do curso (achado V10 de 31/10/2026)", () => {
  it("atendente não dá desconto nem bolsa; o dono dá", async () => {
    const plan = await createPlan("monthly", 15000);
    setCurrentActor({ userId: "usr-atendente", name: "Atendente", profile: "attendant" });
    await expect(
      clientsService.create({ ...base(plan.id), discount: { type: "percentage", value: 100, scholarship: true } }),
    ).rejects.toMatchObject({ fields: [{ field: "discount", message: "Desconto e bolsa só com a permissão de cobranças." }] });
    const plain = await clientsService.create({ ...base(plan.id), name: "Bia" });
    await expect(
      clientsService.update(plain.id, { discount: { type: "fixed", value: 5000 } }),
    ).rejects.toMatchObject({ fields: [{ field: "discount" }] });
    // Mudar outro campo, sem mexer no desconto, segue valendo.
    await expect(clientsService.update(plain.id, { notes: "Faixa azul" })).resolves.toBeTruthy();

    setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
    const scholar = await clientsService.create({
      ...base(plan.id),
      name: "Caio",
      discount: { type: "percentage", value: 50, scholarship: true },
    });
    expect(scholar.discount?.value).toBe(50);
  });
});
