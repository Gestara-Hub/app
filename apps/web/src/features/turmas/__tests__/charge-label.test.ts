import { describe, expect, it } from "vitest";
import { chargeAccessibleLabel } from "../charge-label";

describe("nome da cobrança para leitor de tela (achado 46)", () => {
  it("diz qual cobrança é, não só o aluno", () => {
    expect(chargeAccessibleLabel({ kind: "membership", competence: "2026-10", dueDate: "2026-10-10" })).toBe("mensalidade out/2026");
    expect(chargeAccessibleLabel({ kind: "dropin", dueDate: "2026-10-23" })).toBe("aula avulsa de 23/10");
    expect(chargeAccessibleLabel({ kind: "extra", description: "Kimono", dueDate: "2026-10-10" })).toBe("cobrança Kimono");
    expect(
      chargeAccessibleLabel({ kind: "course", description: "Confeitaria", cycleIndex: 2, cycleTotal: 4, dueDate: "2026-11-15" }),
    ).toBe("parcela 2 de 4 do curso Confeitaria");
  });
});
