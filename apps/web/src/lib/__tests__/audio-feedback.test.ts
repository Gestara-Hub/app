import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Som no app instalado do iPhone (25/11/2026): tocador "interrupted" na volta ao
 * app e trocado por um novo no toque (chamada); o sino, que nao vem de toque,
 * nao troca nem toca com o tocador parado.
 */

class FakeContext {
  static created: FakeContext[] = [];
  state: string = "suspended";
  currentTime = 0;
  destination = {};
  oscillators = 0;
  closed = false;
  constructor() {
    FakeContext.created.push(this);
  }
  resume() {
    if (this.state === "suspended") this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} };
  }
  createOscillator() {
    this.oscillators += 1;
    return { type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
}

async function freshModule() {
  vi.resetModules();
  return import("../audio-feedback");
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  FakeContext.created = [];
  vi.stubGlobal("window", { AudioContext: FakeContext, addEventListener() {} });
  vi.stubGlobal("document", { addEventListener() {}, visibilityState: "visible" });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("som no app instalado", () => {
  it("toque troca o tocador interrompido por um novo e toca", async () => {
    const { playAudioFeedback } = await freshModule();
    playAudioFeedback("checkin");
    await flush();
    const first = FakeContext.created[0]!;
    expect(first.oscillators).toBeGreaterThan(0);

    first.state = "interrupted";
    playAudioFeedback("checkin");
    await flush();
    expect(first.closed).toBe(true);
    const second = FakeContext.created[1]!;
    expect(second.state).toBe("running");
    expect(second.oscillators).toBeGreaterThan(0);
  });

  it("sino com o tocador parado não troca nem toca", async () => {
    const { playAudioFeedback, playBellChime } = await freshModule();
    playAudioFeedback("checkin");
    await flush();
    const ctx = FakeContext.created[0]!;
    const before = ctx.oscillators;
    ctx.state = "interrupted";
    playBellChime();
    await flush();
    expect(FakeContext.created).toHaveLength(1);
    expect(ctx.oscillators).toBe(before);
  });
});
