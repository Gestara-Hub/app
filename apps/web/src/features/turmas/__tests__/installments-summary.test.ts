import { describe, expect, it } from "vitest";
import { pastDueHint } from "../installments-summary";

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
