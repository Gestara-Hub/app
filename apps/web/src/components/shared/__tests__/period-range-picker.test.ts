import { describe, expect, it } from "vitest";
import { periodDatesLabel, periodFromPreset, periodLabel } from "../period-range-picker";

/** 21/10/2026 (quarta). */
const today = new Date(2026, 9, 21, 12);

describe("filtro de período", () => {
  it("sugestões de mês, trimestre, semestre e ano", () => {
    expect(periodFromPreset("this_month", today)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodFromPreset("last_month", today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodFromPreset("this_quarter", today)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodFromPreset("last_quarter", today)).toMatchObject({ from: "2026-07-01", to: "2026-09-30" });
    expect(periodFromPreset("this_semester", today)).toMatchObject({ from: "2026-07-01", to: "2026-12-31" });
    expect(periodFromPreset("last_semester", today)).toMatchObject({ from: "2026-01-01", to: "2026-06-30" });
    expect(periodFromPreset("this_year", today)).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodFromPreset("last_year", today)).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    expect(periodFromPreset("last_12_months", today)).toMatchObject({ from: "2025-11-01", to: "2026-10-31" });
    expect(periodFromPreset("all", today)).toEqual({ preset: "all" });
  });

  it("semestre passado no primeiro semestre cai no ano anterior", () => {
    expect(periodFromPreset("last_semester", new Date(2026, 2, 10))).toMatchObject({ from: "2025-07-01", to: "2025-12-31" });
  });

  it("rótulo: a sugestão ou o intervalo", () => {
    expect(periodLabel(periodFromPreset("this_quarter", today))).toBe("Este trimestre");
    expect(periodLabel({ from: "2026-08-05", to: "2026-09-20" })).toBe("05/08/2026 a 20/09/2026");
    expect(periodLabel({ from: "2026-08-05" })).toBe("Desde 05/08/2026");
    expect(periodLabel({})).toBe("Todo o período");
  });

  it("datas a vista no botão: curtas no mesmo ano, completas entre anos", () => {
    expect(periodDatesLabel(periodFromPreset("this_semester", today))).toBe("01/07 a 31/12/2026");
    expect(periodDatesLabel(periodFromPreset("last_12_months", today))).toBe("01/11/2025 a 31/10/2026");
    expect(periodDatesLabel({ from: "2026-08-05" })).toBe("desde 05/08/2026");
    expect(periodDatesLabel(periodFromPreset("all", today))).toBe("");
  });
});
