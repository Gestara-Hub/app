import { describe, expect, it } from "vitest";
import { pauseDescription, pausedChargeDescription, planSwitchDescription, replacedMembershipCharges } from "../plan-switch";

const charge = (status: string, amountCents: number, periodStart: string) => ({
  status,
  amountCents,
  periodStart,
  dueDate: periodStart,
});

describe("troca de plano do aluno (achado 28)", () => {
  it("conta só as mensalidades em aberto a partir do início do plano novo", () => {
    const replaced = replacedMembershipCharges(
      [
        charge("paid", 15000, "2026-10-01"),
        charge("pending", 15000, "2026-11-01"),
        charge("overdue", 15000, "2026-10-15"),
        charge("canceled", 15000, "2026-12-01"),
        charge("waived", 0, "2026-12-01"),
      ],
      "2026-11-01",
    );
    expect(replaced).toEqual({ count: 2, totalCents: 15000 });
  });

  it("descreve o que muda, com valores e datas", () => {
    const text = planSwitchDescription({
      fromPlan: "Quinzenal",
      toPlan: "Mensal",
      startDate: "2026-11-01",
      replaced: { count: 2, totalCents: 30000 },
      firstCharge: { amountCents: 20000, dueDate: "2026-11-10" },
    });
    expect(text).toContain("muda de Quinzenal para Mensal, valendo a partir de 01/11");
    expect(text).toContain("2 mensalidades em aberto (R$");
    expect(text).toContain("deixam de valer e são refeitas");
    expect(text).toContain("vencimento em 10/11");
    expect(text).toContain("O que já foi pago não muda.");
  });

  it("concorda no singular e avisa quando não há nada para refazer", () => {
    expect(
      planSwitchDescription({
        fromPlan: "A",
        toPlan: "B",
        startDate: "2026-11-01",
        replaced: { count: 1, totalCents: 10000 },
      }),
    ).toContain("1 mensalidade em aberto (R$");
    expect(
      planSwitchDescription({
        fromPlan: "A",
        toPlan: "B",
        startDate: "2026-11-01",
        replaced: { count: 1, totalCents: 10000 },
      }),
    ).toContain("deixa de valer e é refeita");
    expect(
      planSwitchDescription({
        fromPlan: "A",
        toPlan: "B",
        startDate: "2026-11-01",
        replaced: { count: 0, totalCents: 0 },
      }),
    ).toContain("Não há mensalidade em aberto para refazer.");
  });
});

describe("pausa da assinatura", () => {
  it("diz o que muda e o que não muda ao pausar", () => {
    const text = pauseDescription();
    expect(text).toContain("lembrete de WhatsApp deixa de sair");
    expect(text).toContain("O que já foi pago não muda.");
  });

  it("lista a mensalidade em aberto do mês, no singular e no plural", () => {
    expect(pausedChargeDescription([{ amountCents: 15000, dueDate: "2026-10-10", status: "pending" }])).toContain(
      "A mensalidade em curso está em aberto: R$",
    );
    const many = pausedChargeDescription([
      { amountCents: 7500, dueDate: "2026-10-10", status: "pending" },
      { amountCents: 7500, dueDate: "2026-10-25", status: "pending" },
    ]);
    expect(many).toContain("As mensalidades em curso estão em aberto");
    expect(many).toContain("(vence 10/10) e");
    expect(many).toContain("(vence 25/10)");
  });
});
