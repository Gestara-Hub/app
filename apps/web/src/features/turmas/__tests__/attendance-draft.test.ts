import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attendanceDraftKey,
  clearStoredDraft,
  pruneDraft,
  readStoredDraft,
  writeStoredDraft,
} from "../attendance-draft";

// Rascunho da chamada no aparelho (12/11/2026).
const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
};

describe("rascunho da chamada", () => {
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("window", { localStorage: localStorageStub });
  });
  afterEach(() => vi.unstubAllGlobals());

  const key = attendanceDraftKey("user-1", "session-1");

  it("guarda e lê de volta as marcações; vazio apaga", () => {
    writeStoredDraft(key, new Map([["ana", "present"], ["bia", null]]), new Date("2026-11-12T10:00:00Z"));
    expect(readStoredDraft(key, Date.parse("2026-11-12T11:00:00Z"))).toEqual({
      changes: [
        { studentId: "ana", status: "present" },
        { studentId: "bia", status: null },
      ],
      savedAt: "2026-11-12T10:00:00.000Z",
    });
    writeStoredDraft(key, new Map());
    expect(memory.has(key)).toBe(false);
  });

  it("rascunho com mais de 7 dias ou estragado some", () => {
    writeStoredDraft(key, new Map([["ana", "present"]]), new Date("2026-11-01T10:00:00Z"));
    expect(readStoredDraft(key, Date.parse("2026-11-12T10:00:00Z"))).toBeNull();
    expect(memory.has(key)).toBe(false);
    memory.set(key, "{quebrado");
    expect(readStoredDraft(key)).toBeNull();
  });

  it("uma pessoa não vê o rascunho de outra na mesma aula", () => {
    writeStoredDraft(key, new Map([["ana", "present"]]));
    expect(readStoredDraft(attendanceDraftKey("user-2", "session-1"))).toBeNull();
    clearStoredDraft(key);
    expect(readStoredDraft(key)).toBeNull();
  });

  it("continuar fica só com o que ainda muda a aula", () => {
    const saved = new Map<string, "present" | "absent" | "justified" | null>([
      ["ana", "present"],
      ["bia", null],
      ["caio", "absent"],
    ]);
    const kept = pruneDraft(
      [
        { studentId: "ana", status: "present" }, // ja salvo assim
        { studentId: "bia", status: "present" },
        { studentId: "caio", status: null },
        { studentId: "saiu-da-aula", status: "present" },
      ],
      saved,
    );
    expect([...kept]).toEqual([
      ["bia", "present"],
      ["caio", null],
    ]);
  });
});
