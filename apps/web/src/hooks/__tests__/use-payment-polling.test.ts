import { describe, expect, it } from "vitest";
import { pollDelayMs } from "../use-payment-polling";

describe("conferencia de pagamento (Pix aguardando)", () => {
  it("rapida no comeco, espacada depois e para em 20 minutos", () => {
    expect(pollDelayMs(0)).toBe(3_500);
    expect(pollDelayMs(119_000)).toBe(3_500);
    expect(pollDelayMs(2 * 60_000)).toBe(10_000);
    expect(pollDelayMs(9 * 60_000)).toBe(10_000);
    expect(pollDelayMs(10 * 60_000)).toBe(30_000);
    expect(pollDelayMs(20 * 60_000)).toBeNull();
  });

  it("uma aba esquecida por uma hora confere bem menos que antes (~1.000 vezes)", () => {
    let elapsed = 0;
    let checks = 0;
    for (;;) {
      const delay = pollDelayMs(elapsed);
      if (delay === null || elapsed > 60 * 60_000) break;
      elapsed += delay;
      checks += 1;
    }
    expect(checks).toBeLessThan(110);
    expect(elapsed).toBeLessThanOrEqual(21 * 60_000);
  });
});
