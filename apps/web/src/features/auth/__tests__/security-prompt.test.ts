import { describe, expect, it } from "vitest";
import { canAskSecurity, usedLongEnough } from "../security-prompt";

/** Regra do aviso da verificacao em duas etapas (doc product/25, secao 5). */

describe("aviso de segurança", () => {
  it("sem 'Agora não', pergunta; depois, só em 30 dias e no máximo 3 vezes", () => {
    expect(canAskSecurity(undefined, "2026-09-22")).toBe(true);
    expect(canAskSecurity({ dismissCount: 1, lastDismissedAt: "2026-09-01" }, "2026-09-22")).toBe(false);
    expect(canAskSecurity({ dismissCount: 1, lastDismissedAt: "2026-08-23" }, "2026-09-22")).toBe(true);
    expect(canAskSecurity({ dismissCount: 3, lastDismissedAt: "2026-01-01" }, "2026-09-22")).toBe(false);
  });

  it("7 dias de uso contam do primeiro dia no app", () => {
    expect(usedLongEnough(undefined, "2026-09-22")).toBe(false);
    expect(usedLongEnough({ firstSeenAt: "2026-09-16" }, "2026-09-22")).toBe(false);
    expect(usedLongEnough({ firstSeenAt: "2026-09-15" }, "2026-09-22")).toBe(true);
  });
});
