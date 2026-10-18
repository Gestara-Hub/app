import { describe, expect, it } from "vitest";
import { pickNextSession, type SessionLike } from "../next-session";

const TODAY = "2026-10-19";
const s = (id: string, date: string, start: string, status: SessionLike["status"] = "scheduled"): SessionLike => ({
  id,
  date,
  start,
  status,
});

describe("atalho da turma para a chamada", () => {
  const list = [s("a", TODAY, "08:00"), s("b", TODAY, "18:00"), s("c", "2026-10-21", "08:00")];

  it("antes da primeira aula do dia, a primeira", () => {
    expect(pickNextSession(list, TODAY, "07:00")?.id).toBe("a");
  });

  it("depois que começou, a mais recente do dia (mesmo já passada)", () => {
    expect(pickNextSession(list, TODAY, "09:30")?.id).toBe("a");
    expect(pickNextSession(list, TODAY, "20:00")?.id).toBe("b");
  });

  it("sem aula hoje, a próxima; cancelada e passada não contam", () => {
    const later = [s("old", "2026-10-18", "08:00"), s("x", "2026-10-20", "08:00", "canceled"), s("c", "2026-10-21", "08:00")];
    expect(pickNextSession(later, TODAY, "10:00")?.id).toBe("c");
  });

  it("sem aulas pela frente, nada", () => {
    expect(pickNextSession([], TODAY, "10:00")).toBeNull();
  });
});
