import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Marcas de "ja vi" na conta (25/11/2026): a conta vale mais que o navegador,
 * marca antiga so no navegador sobe uma vez, e "off" desfaz.
 */

async function freshModule() {
  vi.resetModules();
  return import("../seen-marks");
}

let data: Map<string, string>;

beforeEach(() => {
  data = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

describe("marcas de já vi", () => {
  it("marcar grava no navegador e manda para a conta", async () => {
    const marks = await freshModule();
    const persist = vi.fn();
    marks.setSeenMarksPersister(persist);
    marks.setSeenMarksFromAccount({}, true);
    marks.setSeenMark("tour:x");
    expect(marks.hasSeenMark("tour:x")).toBe(true);
    expect(data.get("tour:x")).toBe("1");
    expect(persist).toHaveBeenCalledWith({ "tour:x": expect.any(String) });
    // Marcar de novo não grava outra vez.
    persist.mockClear();
    marks.setSeenMark("tour:x");
    expect(persist).not.toHaveBeenCalled();
  });

  it("marca que veio da conta vale em outro navegador (vazio)", async () => {
    const marks = await freshModule();
    marks.setSeenMarksFromAccount({ "welcome:org": "2026-11-25T10:00:00.000Z" }, true);
    expect(marks.hasSeenMark("welcome:org")).toBe(true);
  });

  it("marca antiga só no navegador sobe para a conta uma vez, depois de a conta responder", async () => {
    data.set("antiga", "1");
    const marks = await freshModule();
    const persist = vi.fn();
    marks.setSeenMarksPersister(persist);
    expect(marks.hasSeenMark("antiga")).toBe(true);
    await Promise.resolve();
    expect(persist).not.toHaveBeenCalled();
    marks.setSeenMarksFromAccount({}, true);
    marks.hasSeenMark("antiga");
    marks.hasSeenMark("antiga");
    await Promise.resolve();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ antiga: expect.any(String) });
  });

  it("off na conta desfaz, mesmo com a marca no navegador", async () => {
    data.set("tour:y", "1");
    const marks = await freshModule();
    const persist = vi.fn();
    marks.setSeenMarksPersister(persist);
    marks.setSeenMarksFromAccount({ "tour:y": "off" }, true);
    expect(marks.hasSeenMark("tour:y")).toBe(false);
    marks.setSeenMark("tour:y", true);
    expect(marks.hasSeenMark("tour:y")).toBe(true);
    marks.setSeenMark("tour:y", false);
    expect(marks.hasSeenMark("tour:y")).toBe(false);
    expect(data.has("tour:y")).toBe(false);
    expect(persist).toHaveBeenLastCalledWith({ "tour:y": "off" });
  });
});

describe("marcas na gravação da conta", () => {
  it("somam às que já estavam, a nova vale mais e o que foge do formato sai", async () => {
    const { mergeUserPreferences } = await import("@gestarahub/contracts");
    const merged = mergeUserPreferences(
      { seen: { a: "2026-11-01T00:00:00.000Z", b: "2026-11-02T00:00:00.000Z" } },
      { seen: { b: "off", c: "2026-11-25T00:00:00.000Z", ["x".repeat(200)]: "2026-11-25" } },
    );
    expect(merged.seen).toEqual({ a: "2026-11-01T00:00:00.000Z", b: "off", c: "2026-11-25T00:00:00.000Z" });
  });
});
