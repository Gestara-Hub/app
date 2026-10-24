import { describe, expect, it } from "vitest";
import { addBusinessDays, brasiliaDay, slaFor } from "../sla";

// 2026-10-21 é quarta-feira.
const at = (iso: string) => new Date(iso);

describe("meta de resposta (2 dias úteis)", () => {
  it("soma dias úteis pulando o fim de semana", () => {
    expect(addBusinessDays("2026-10-21", 2)).toBe("2026-10-23"); // qua -> sex
    expect(addBusinessDays("2026-10-22", 2)).toBe("2026-10-26"); // qui -> seg
    expect(addBusinessDays("2026-10-23", 2)).toBe("2026-10-27"); // sex -> ter
    expect(addBusinessDays("2026-10-24", 2)).toBe("2026-10-27"); // sáb -> ter (conta a partir de segunda)
    expect(addBusinessDays("2026-10-21", 0)).toBe("2026-10-21");
  });

  it("usa o dia de Brasília (UTC-3), não o de Greenwich", () => {
    // 01:00 UTC de sábado ainda é sexta à noite em Brasília.
    expect(brasiliaDay(at("2026-10-24T01:00:00Z"))).toBe("2026-10-23");
    expect(brasiliaDay(at("2026-10-24T12:00:00Z"))).toBe("2026-10-24");
  });

  it("verde no prazo, amarelo no último dia, vermelho depois", () => {
    const since = at("2026-10-21T15:00:00Z"); // quarta
    expect(slaFor(since, at("2026-10-21T20:00:00Z"))).toEqual({ state: "ok", dueOn: "2026-10-23" });
    expect(slaFor(since, at("2026-10-22T20:00:00Z")).state).toBe("ok");
    expect(slaFor(since, at("2026-10-23T14:00:00Z")).state).toBe("last_day");
    expect(slaFor(since, at("2026-10-23T23:30:00Z")).state).toBe("last_day"); // ainda sexta em Brasília
    expect(slaFor(since, at("2026-10-24T12:00:00Z")).state).toBe("late");
  });

  it("pedido no fim de semana só começa a contar na segunda", () => {
    const sat = at("2026-10-24T15:00:00Z");
    expect(slaFor(sat, at("2026-10-26T15:00:00Z")).state).toBe("ok");
    expect(slaFor(sat, at("2026-10-27T15:00:00Z")).state).toBe("last_day");
    expect(slaFor(sat, at("2026-10-28T15:00:00Z")).state).toBe("late");
  });
});
