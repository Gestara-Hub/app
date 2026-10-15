import { describe, expect, it } from "vitest";
import { isAttentionOn, settleAttentionStop, stopAttention } from "../attention";

describe("attention until interaction", () => {
  it("pulses while active and not stopped", () => {
    expect(isAttentionOn(true, null, "plans")).toBe(true);
    expect(isAttentionOn(false, null, "plans")).toBe(false);
  });

  it("stops for the key where the user interacted", () => {
    const stop = stopAttention(null, "plans");
    expect(isAttentionOn(true, stop, "plans")).toBe(false);
  });

  it("pulses again for a new key", () => {
    const stop = stopAttention(null, "plans");
    expect(isAttentionOn(true, stop, "team")).toBe(true);
  });

  it("keeps the same stop when interacting again on the same key", () => {
    const stop = stopAttention(null, 1);
    expect(stopAttention(stop, 1)).toBe(stop);
    expect(stopAttention(stop, 2)).toEqual({ key: 2 });
  });

  it("forgets the stop once inactive, so the next activation pulses", () => {
    const stop = stopAttention(null, "plans");
    expect(settleAttentionStop(true, stop)).toBe(stop);
    const cleared = settleAttentionStop(false, stop);
    expect(cleared).toBeNull();
    expect(isAttentionOn(true, cleared, "plans")).toBe(true);
  });
});
