import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { autoGenerateMembershipCharges } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { createPlan, resetAcademy } from "@/test/academy";

/**
 * Revisao geral de 31/10/2026 (achado V2): voltar da pausa dentro de um periodo
 * ja cobrado recomecava hoje, e a sobreposicao pulava o ciclo inteiro (dias sem
 * cobranca). Agora recomeca no dia seguinte ao fim do periodo cobrado. Hoje: 22/09/2026.
 */

beforeEach(() => {
  resetAcademy();
  setCurrentActor({ userId: "usr-dono", name: "Dono", profile: "owner" });
});

describe("volta da pausa dentro do período já pago", () => {
  it("mês cheio: a cobrança seguinte começa no dia seguinte ao período pago, sem buraco", async () => {
    const plan = await createPlan("monthly", 15000);
    const ana = await clientsService.create({
      name: "Ana",
      phone: "11977770000",
      status: "active",
      planId: plan.id,
      planStartDate: "2026-08-25",
      billingStrategy: "full_cycle",
      cyclePaymentTiming: "prepaid",
      dueDay: 25,
      initialCharge: { amountCents: 15000, dueDate: "2026-08-25", periodStart: "2026-08-25", periodEnd: "2026-09-24" },
    });
    const first = store.charges.find((c) => c.studentId === ana.id && c.kind === "membership")!;
    first.status = "paid";
    first.paidAt = "2026-08-25T12:00:00.000Z";

    await clientsService.update(ana.id, { membershipStatus: "paused" });
    await clientsService.update(ana.id, { membershipStatus: "active" });
    expect(store.clients.find((c) => c.id === ana.id)?.planStartDate).toBe("2026-09-25");

    autoGenerateMembershipCharges("2026-09");
    const periods = store.charges
      .filter((c) => c.studentId === ana.id && c.kind === "membership" && c.status !== "canceled")
      .map((c) => `${c.periodStart}..${c.periodEnd}`)
      .sort();
    expect(periods).toEqual(["2026-08-25..2026-09-24", "2026-09-25..2026-10-24"]);
  });
});
