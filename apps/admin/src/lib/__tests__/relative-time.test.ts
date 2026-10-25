import { describe, expect, it } from "vitest";
import { exactDateTime, relativeDay, relativeTime } from "../relative-time";

const NOW = new Date("2026-10-25T15:00:00Z"); // 12:00 em Brasília

describe("datas relativas do painel", () => {
  it("diz agora para menos de 1 minuto, nos dois sentidos", () => {
    expect(relativeTime(new Date(NOW.getTime() - 20_000), NOW)).toBe("agora");
    expect(relativeTime(new Date(NOW.getTime() + 20_000), NOW)).toBe("agora");
  });

  it("escreve passado e futuro em português", () => {
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe("há 5 minutos");
    expect(relativeTime(new Date(NOW.getTime() - 9 * 3_600_000), NOW)).toBe("há 9 horas");
    expect(relativeTime(new Date(NOW.getTime() + 3 * 86_400_000), NOW)).toBe("em 3 dias");
  });

  it("conta dias civis em Brasília", () => {
    expect(relativeDay("2026-10-25", NOW)).toBe("hoje");
    expect(relativeDay("2026-10-26", NOW)).toBe("amanhã");
    expect(relativeDay("2026-10-24", NOW)).toBe("ontem");
    expect(relativeDay("2026-10-30", NOW)).toBe("em 5 dias");
    expect(relativeDay("2026-10-15", NOW)).toBe("há 10 dias");
    expect(relativeDay("2026-12-25", NOW)).toBe("em 2 meses");
    expect(relativeDay("2025-10-25", NOW)).toBe("há 1 ano");
  });

  it("vira o dia pelo relógio de Brasília, não pelo de Greenwich", () => {
    // 01:00 UTC de 26/10 ainda é 22:00 de 25/10 em Brasília.
    expect(relativeDay("2026-10-25", new Date("2026-10-26T01:00:00Z"))).toBe("hoje");
  });

  it("mostra a data exata em Brasília", () => {
    expect(exactDateTime(new Date("2026-10-25T14:16:32Z"))).toBe("25/10/2026 11:16:32");
  });
});
