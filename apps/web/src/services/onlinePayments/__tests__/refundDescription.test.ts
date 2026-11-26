import { describe, expect, it } from "vitest";
import { refundDescription } from "../refundDescription";

/** Motivo do estorno no Asaas (26/11/2026): sempre com a marca do app no fim. */
describe("motivo do estorno no Asaas", () => {
  it("com motivo escrito, a marca vem no fim; vazio, só a marca", () => {
    expect(refundDescription("Aluno desistiu")).toBe("Aluno desistiu · Estorno pelo GestaraHub");
    expect(refundDescription("  ")).toBe("Estorno pelo GestaraHub");
    expect(refundDescription(undefined)).toBe("Estorno pelo GestaraHub");
  });
});
