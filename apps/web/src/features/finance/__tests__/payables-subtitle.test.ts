import { describe, expect, it } from "vitest";
import { payablesSubtitle } from "../lib";

describe("Contas a pagar no Resumo (achado 54)", () => {
  it("diz que o quadro é de hoje, com a data", () => {
    expect(payablesSubtitle("2026-10-23")).toBe("A partir de hoje, 23/10: atrasadas e as que vencem em 7 dias");
  });
});
