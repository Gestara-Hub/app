import { describe, expect, it } from "vitest";
import { planName, planSituation } from "../space-plan";

const TODAY = "2026-10-24";

describe("plano de um espaço no painel", () => {
  it("dá nome ao plano", () => {
    expect(planName(undefined)).toBe("Grátis");
    expect(planName({ tier: "pro", interval: "monthly" })).toBe("Profissional mensal");
    expect(planName({ tier: "pro", interval: "yearly" })).toBe("Profissional anual");
    expect(planName({ tier: "scale" })).toBe("Expansão mensal");
  });

  it("Grátis, Grátis por falta de pagamento e plano ativo", () => {
    expect(planSituation(undefined, TODAY).key).toBe("free");
    expect(planSituation({ tier: "free", revertedFrom: { tier: "pro", on: "2026-10-01" } }, TODAY)).toMatchObject({
      key: "reverted",
      label: "Voltou ao Grátis",
    });
    expect(planSituation({ tier: "pro", renewsOn: "2026-11-10" }, TODAY)).toEqual({ key: "active", label: "Ativo", detail: "Renova em 10/11/2026" });
  });

  it("renovação atrasada: carência por 5 dias e depois vencido", () => {
    expect(planSituation({ tier: "pro", renewsOn: "2026-10-24" }, TODAY).key).toBe("active");
    expect(planSituation({ tier: "pro", renewsOn: "2026-10-23" }, TODAY)).toMatchObject({ key: "grace", detail: expect.stringContaining("28/10/2026") });
    expect(planSituation({ tier: "pro", renewsOn: "2026-10-19" }, TODAY).key).toBe("grace");
    expect(planSituation({ tier: "pro", renewsOn: "2026-10-18" }, TODAY).key).toBe("overdue");
  });

  it("cortesia e troca marcada", () => {
    expect(planSituation({ tier: "pro", courtesyUntil: "2026-11-30" }, TODAY)).toEqual({ key: "courtesy", label: "Cortesia", detail: "Até 30/11/2026" });
    expect(planSituation({ tier: "pro", renewsOn: "2026-11-10", scheduledChange: { tier: "free", effectiveOn: "2026-11-10" } }, TODAY)).toMatchObject({
      key: "scheduled",
      detail: "Grátis em 10/11/2026",
    });
  });
});
