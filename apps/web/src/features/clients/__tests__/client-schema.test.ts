import { describe, expect, it } from "vitest";
import type { ClassBillingMode } from "@gestarahub/contracts";
import { getSegmentPreset } from "@/lib/business-segment-presets";
import { clientFormSchema, defaultPaymentMode, isPackageSale, type ClientFormValues } from "../client-schema";

const ALL_MODES: ClassBillingMode[] = ["membership", "course", "package", "free"];

describe("defaultPaymentMode", () => {
  it("aluno novo paga mensalidade nas áreas de mensalidade", () => {
    expect(defaultPaymentMode({ isClasses: true, areaBillingMode: "membership" })).toBe("membership");
  });

  it("aluno novo começa sem mensalidade nas áreas de curso ou sem cobrança", () => {
    for (const areaBillingMode of ["course", "free"] as const) {
      expect(defaultPaymentMode({ isClasses: true, areaBillingMode }), areaBillingMode).toBe("none");
    }
  });

  it("aluno novo começa em \"Pacote de aulas\" na área de pacote", () => {
    expect(defaultPaymentMode({ isClasses: true, areaBillingMode: "package" })).toBe("package");
  });

  it("outra área segue a resposta de \"Como você cobra?\"", () => {
    const modeFor = (billing: ClassBillingMode) =>
      defaultPaymentMode({
        isClasses: true,
        areaBillingMode: getSegmentPreset("custom", "none", billing).defaultBillingMode,
      });
    expect(modeFor("membership")).toBe("membership");
    expect(modeFor("course")).toBe("none");
    expect(modeFor("package")).toBe("package");
    expect(modeFor("free")).toBe("none");
  });

  it("editar mantém o que o aluno tem, em qualquer área", () => {
    for (const areaBillingMode of ALL_MODES) {
      expect(defaultPaymentMode({ client: { planId: "p1" }, isClasses: true, areaBillingMode })).toBe("membership");
      expect(defaultPaymentMode({ client: {}, isClasses: true, areaBillingMode })).toBe("none");
      expect(
        defaultPaymentMode({ client: { discount: { scholarship: true } }, isClasses: true, areaBillingMode }),
      ).toBe("scholarship");
    }
  });

  it("aluno salvo sem plano e com pacote em uso abre em \"Pacote de aulas\"", () => {
    for (const areaBillingMode of ALL_MODES) {
      expect(defaultPaymentMode({ client: {}, isClasses: true, areaBillingMode, hasActivePackage: true })).toBe("package");
      // Plano e bolsa continuam valendo mais que o pacote.
      expect(
        defaultPaymentMode({ client: { planId: "p1" }, isClasses: true, areaBillingMode, hasActivePackage: true }),
      ).toBe("membership");
      expect(
        defaultPaymentMode({
          client: { discount: { scholarship: true } },
          isClasses: true,
          areaBillingMode,
          hasActivePackage: true,
        }),
      ).toBe("scholarship");
    }
  });

  it("fora do modelo de turmas não há escolha", () => {
    expect(defaultPaymentMode({ isClasses: false, areaBillingMode: "course" })).toBeUndefined();
  });
});

describe("venda do pacote no cadastro do aluno", () => {
  const base: ClientFormValues = {
    name: "Aluna Pacote",
    phone: "(11) 99999-0000",
    paymentMode: "package",
    sellsPackage: true,
    packageId: "lp-1",
    packagePriceCents: 30000,
    packageInstallments: "1",
    packageFirstDueDate: "2026-10-15",
  };
  const errorsOf = (values: ClientFormValues) => {
    const result = clientFormSchema.safeParse(values);
    return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
  };

  it("vende só com \"Pacote de aulas\" no aluno novo", () => {
    expect(isPackageSale(base)).toBe(true);
    expect(isPackageSale({ ...base, sellsPackage: false })).toBe(false);
    expect(isPackageSale({ ...base, paymentMode: "none" })).toBe(false);
  });

  it("pacote completo passa e não pede plano", () => {
    expect(clientFormSchema.safeParse(base).success).toBe(true);
  });

  it("pede pacote, valor e 1º vencimento", () => {
    expect(errorsOf({ ...base, packageId: "", packagePriceCents: 0, packageFirstDueDate: "" })).toEqual({
      packageId: "Selecione o pacote.",
      packagePriceCents: "Informe o valor.",
      packageFirstDueDate: "Informe o 1º vencimento.",
    });
  });

  it("cada parcela precisa de pelo menos R$ 0,01", () => {
    expect(errorsOf({ ...base, packagePriceCents: 2, packageInstallments: "3" })).toEqual({
      packageInstallments: "Cada parcela precisa de pelo menos R$ 0,01.",
    });
  });

  it("sem venda (edição ou sem permissão), os campos do pacote não valem", () => {
    expect(clientFormSchema.safeParse({ ...base, sellsPackage: false, packageId: "", packagePriceCents: 0 }).success).toBe(
      true,
    );
  });
});
