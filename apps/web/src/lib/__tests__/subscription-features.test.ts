import { describe, expect, it } from "vitest";
import { proOnlyFeatures, tierHasFeature } from "../subscription";

describe("o que o Profissional inclui a mais (achado 67)", () => {
  it("não lista o pagamento online, que já é do Grátis", () => {
    expect(tierHasFeature("free", "online_payments")).toBe(true);
    expect(proOnlyFeatures()).not.toContain("online_payments");
    expect(proOnlyFeatures()).toEqual(["messaging", "reports_advanced", "certificates"]);
  });
});
