import { describe, expect, it } from "vitest";
import { unitHeaderLine } from "../format";

describe("cabeçalho do espaço nos documentos (achado 45)", () => {
  it("o telefone sai com máscara", () => {
    expect(unitHeaderLine({ name: "Unidade Centro", phone: "11933334444" })).toBe("Unidade Centro · (11) 93333-4444");
  });

  it("sem telefone ou sem nome, só o que existe", () => {
    expect(unitHeaderLine({ name: "Unidade Centro" })).toBe("Unidade Centro");
    expect(unitHeaderLine({ phone: "1133334444" })).toBe("(11) 3333-4444");
    expect(unitHeaderLine(undefined)).toBeUndefined();
  });
});
