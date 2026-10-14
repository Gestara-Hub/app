import { describe, expect, it } from "vitest";
import { defaultPaymentMode } from "../client-schema";

describe("defaultPaymentMode", () => {
  it("aluno novo paga mensalidade nas áreas de mensalidade", () => {
    expect(defaultPaymentMode({ isClasses: true, isCourseArea: false })).toBe("membership");
  });

  it("aluno novo começa sem mensalidade na área de curso", () => {
    expect(defaultPaymentMode({ isClasses: true, isCourseArea: true })).toBe("none");
  });

  it("editar mantém o que o aluno tem, em qualquer área", () => {
    for (const isCourseArea of [false, true]) {
      expect(defaultPaymentMode({ client: { planId: "p1" }, isClasses: true, isCourseArea })).toBe("membership");
      expect(defaultPaymentMode({ client: {}, isClasses: true, isCourseArea })).toBe("none");
      expect(
        defaultPaymentMode({ client: { discount: { scholarship: true } }, isClasses: true, isCourseArea }),
      ).toBe("scholarship");
    }
  });

  it("fora do modelo de turmas não há escolha", () => {
    expect(defaultPaymentMode({ isClasses: false, isCourseArea: true })).toBeUndefined();
  });
});
