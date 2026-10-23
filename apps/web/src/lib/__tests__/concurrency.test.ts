import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../concurrency";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  it("nunca passa do limite e devolve na ordem dos itens", async () => {
    let running = 0;
    let peak = 0;
    const { results, skipped } = await mapWithConcurrency([5, 1, 4, 2, 3, 1], 2, async (ms, i) => {
      running += 1;
      peak = Math.max(peak, running);
      await wait(ms);
      running -= 1;
      return i;
    });
    expect(peak).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(skipped).toBe(0);
  });

  it("depois do prazo, não começa itens novos", async () => {
    const done: number[] = [];
    let now = 1_000;
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const { skipped } = await mapWithConcurrency([1, 2, 3, 4], 1, async (n) => {
        done.push(n);
        now += 10; // cada item "leva" 10 ms
      }, { deadline: 1_015 });
      expect(done).toEqual([1, 2]);
      expect(skipped).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });

  it("lista vazia não chama nada", async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual({ results: [], skipped: 0 });
  });
});
