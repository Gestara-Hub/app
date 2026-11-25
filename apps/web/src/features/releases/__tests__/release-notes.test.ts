import { describe, expect, it } from "vitest";
import { RELEASE_NOTES, releaseNotesByDay } from "../release-notes";

/** Novidades por dia (25/11/2026): uma data so, selo da versao mais nova do dia. */
describe("releaseNotesByDay", () => {
  it("junta as versões do mesmo dia na ordem, sem repetir item", () => {
    const days = releaseNotesByDay([
      { version: "2026.11.25-2", date: "2026-11-25", items: [{ text: "B" }, { text: "A" }] },
      { version: "2026.11.25", date: "2026-11-25", items: [{ text: "A" }, { text: "C" }] },
      { version: "2026.11.24", date: "2026-11-24", items: [{ text: "D" }] },
    ]);
    expect(days).toEqual([
      { date: "2026-11-25", latestVersion: "2026.11.25-2", items: [{ text: "B" }, { text: "A" }, { text: "C" }] },
      { date: "2026-11-24", latestVersion: "2026.11.24", items: [{ text: "D" }] },
    ]);
  });

  it("as notas reais têm um dia por data", () => {
    const days = releaseNotesByDay();
    expect(new Set(days.map((d) => d.date)).size).toBe(days.length);
    expect(days[0]?.latestVersion).toBe(RELEASE_NOTES[0]?.version);
  });
});
