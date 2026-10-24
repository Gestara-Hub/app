import { describe, expect, it } from "vitest";
import { payablesSubtitle, payoutDateInfo } from "../lib";

describe("Contas a pagar no Resumo (achado 54)", () => {
  it("diz que o quadro é de hoje, com a data", () => {
    expect(payablesSubtitle("2026-10-23")).toBe("A partir de hoje, 23/10: atrasadas e as que vencem em 7 dias");
  });
});

describe("Professores: mês vencido sem fechar (achado 55)", () => {
  const base = { dueDate: "2026-10-05", today: "2026-10-23" };

  it("avisa que falta fechar e pagar quando o mês venceu como prévia", () => {
    expect(payoutDateInfo({ ...base, status: "open" })).toEqual({ text: "venceu 05/10: falta fechar e pagar", late: true });
    expect(payoutDateInfo({ ...base, status: "closed" })).toEqual({ text: "venceu 05/10: falta pagar", late: true });
  });

  it("antes do vencimento ou pago, fica como era", () => {
    expect(payoutDateInfo({ status: "open", dueDate: "2026-11-05", today: "2026-10-23" })).toEqual({ text: "vence 05/11", late: false });
    expect(payoutDateInfo({ ...base, status: "paid", paidAt: "2026-10-06T12:00:00Z" })).toEqual({ text: "pago em 06/10", late: false });
  });
});
