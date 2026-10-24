import { describe, expect, it } from "vitest";
import { pastDueHint, pastEndHint } from "../installments-summary";

describe("pastDueHint", () => {
  it("avisa quando o vencimento já passou (COB-16)", () => {
    expect(pastDueHint("2020-01-10", "2026-09-22")).toBe("Data que já passou: a cobrança entra atrasada.");
    expect(pastDueHint("2026-09-21", "2026-09-22")).toBeDefined();
  });

  it("hoje, futuro ou data incompleta não avisa", () => {
    expect(pastDueHint("2026-09-22", "2026-09-22")).toBeUndefined();
    expect(pastDueHint("2026-10-05", "2026-09-22")).toBeUndefined();
    expect(pastDueHint("", "2026-09-22")).toBeUndefined();
  });
});

describe("pastEndHint (parcelas depois do fim, achados 26 e 33)", () => {
  it("avisa quando a última parcela passa do fim do curso", () => {
    // 3x a partir de 23/10: 23/10, 23/11 e 23/12; o curso termina em 20/11.
    expect(pastEndHint(3, "2026-10-23", "2026-11-20", "o fim do curso")).toBe(
      "A última parcela vence em 23/12/2026, depois do fim do curso (20/11/2026). Pode seguir: a cobrança continua valendo.",
    );
  });

  it("avisa no pacote que vale 90 dias parcelado em 12x", () => {
    expect(pastEndHint(12, "2026-10-23", "2027-01-21", "a validade do pacote")).toContain(
      "depois da validade do pacote (21/01/2027)",
    );
  });

  it("não avisa quando cabe, à vista, sem fim ou com data incompleta", () => {
    expect(pastEndHint(3, "2026-10-23", "2026-12-23", "o fim do curso")).toBeUndefined();
    expect(pastEndHint(1, "2026-10-23", "2026-10-01", "o fim do curso")).toBeUndefined();
    expect(pastEndHint(3, "2026-10-23", undefined, "o fim do curso")).toBeUndefined();
    expect(pastEndHint(3, "", "2026-11-20", "o fim do curso")).toBeUndefined();
  });
});
