import { describe, expect, it } from "vitest";
import { csvSafe } from "../documents/csv";
import { likeExact } from "../supabase/like";

describe("planilha sem fórmula vinda de dado digitado (auditoria de 30/10/2026)", () => {
  it("célula que começa como fórmula vira texto", () => {
    expect(csvSafe("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(csvSafe("+5511999990000")).toBe("'+5511999990000");
    expect(csvSafe("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvSafe("-cmd")).toBe("'-cmd");
  });

  it("número negativo e texto comum ficam como estão", () => {
    expect(csvSafe("-150,00")).toBe("-150,00");
    expect(csvSafe("-R$ 1.250,00")).toBe("-R$ 1.250,00");
    expect(csvSafe("Ana Souza")).toBe("Ana Souza");
    expect(csvSafe("")).toBe("");
  });
});

describe("e-mail como busca exata no ilike", () => {
  it("% e _ deixam de ser curingas", () => {
    expect(likeExact("a%")).toBe("a\\%");
    expect(likeExact("ana_souza@exemplo.com")).toBe("ana\\_souza@exemplo.com");
    expect(likeExact("ana@exemplo.com")).toBe("ana@exemplo.com");
  });
});
