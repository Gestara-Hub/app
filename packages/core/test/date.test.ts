import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  dateInSpace,
  elapsedLabel,
  isPastSlot,
  nowTime,
  relativeDateLabel,
  resolveSpaceTimeZone,
  startOfDayInSpace,
  endOfDayInSpace,
  setSpaceTimeZoneProvider,
  timeZoneForState,
  todayISO,
} from "../src/date.ts";

const TODAY = "2026-10-14";
const label = (iso: string, relative?: boolean) => relativeDateLabel(iso, { today: TODAY, relative });

describe("relativeDateLabel: datas relativas", () => {
  it("mesmo dia é hoje", () => {
    assert.equal(label("2026-10-14"), "hoje");
  });

  it("um dia antes é ontem", () => {
    assert.equal(label("2026-10-13"), "ontem");
  });

  it("de 2 a 6 dias atrás vira há N dias", () => {
    assert.equal(label("2026-10-12"), "há 2 dias");
    assert.equal(label("2026-10-11"), "há 3 dias");
    assert.equal(label("2026-10-08"), "há 6 dias");
  });

  it("um dia depois é amanhã", () => {
    assert.equal(label("2026-10-15"), "amanhã");
  });

  it("de 2 a 6 dias à frente vira em N dias", () => {
    assert.equal(label("2026-10-16"), "em 2 dias");
    assert.equal(label("2026-10-20"), "em 6 dias");
  });

  it("aceita data e hora, usando só a data", () => {
    assert.equal(label("2026-10-13T23:59:00.000Z"), "ontem");
    assert.equal(label("2026-10-14T00:00:00"), "hoje");
  });

  it("conta dias na virada de mês e de ano", () => {
    assert.equal(relativeDateLabel("2026-09-30", { today: "2026-10-01" }), "ontem");
    assert.equal(relativeDateLabel("2025-12-31", { today: "2026-01-02" }), "há 2 dias");
    assert.equal(relativeDateLabel("2027-01-05", { today: "2026-12-30" }), "em 6 dias");
  });

  it("conta dias corretamente na troca de horário de verão", () => {
    assert.equal(relativeDateLabel("2026-03-08", { today: "2026-03-09" }), "ontem");
    assert.equal(relativeDateLabel("2026-11-01", { today: "2026-11-03" }), "há 2 dias");
  });
});

describe("relativeDateLabel: forma curta", () => {
  it("7 dias ou mais no mesmo ano vira dia e mês", () => {
    assert.equal(label("2026-10-07"), "7 out");
    assert.equal(label("2026-10-21"), "21 out");
    assert.equal(label("2026-01-28"), "28 jan");
    assert.equal(label("2026-12-25"), "25 dez");
  });

  it("dia sem zero à esquerda", () => {
    assert.equal(label("2026-03-05"), "5 mar");
  });

  it("outro ano vira mês/ano", () => {
    assert.equal(label("2025-01-28"), "01/2025");
    assert.equal(label("2027-11-02"), "11/2027");
  });

  it("perto da virada, fora da janela de 6 dias, usa o ano da data", () => {
    assert.equal(relativeDateLabel("2025-12-20", { today: "2026-01-02" }), "12/2025");
    assert.equal(relativeDateLabel("2027-01-10", { today: "2026-12-30" }), "01/2027");
  });

  it("todos os meses abreviados em pt-BR", () => {
    const months = Array.from({ length: 12 }, (_, i) => label(`2026-${String(i + 1).padStart(2, "0")}-01`, false));
    assert.deepEqual(months, [
      "1 jan",
      "1 fev",
      "1 mar",
      "1 abr",
      "1 mai",
      "1 jun",
      "1 jul",
      "1 ago",
      "1 set",
      "1 out",
      "1 nov",
      "1 dez",
    ]);
  });
});

describe("relativeDateLabel: relative false", () => {
  it("retorna só a forma curta mesmo perto de hoje", () => {
    assert.equal(label("2026-10-14", false), "14 out");
    assert.equal(label("2026-10-13", false), "13 out");
    assert.equal(label("2026-10-15", false), "15 out");
    assert.equal(label("2026-10-11", false), "11 out");
  });

  it("outro ano continua mês/ano", () => {
    assert.equal(label("2025-10-13", false), "10/2025");
  });

  it("relative true explícito equivale ao padrão", () => {
    assert.equal(label("2026-10-13", true), "ontem");
  });
});

describe("relativeDateLabel: entradas inválidas", () => {
  it("vazio retorna vazio", () => {
    assert.equal(label(""), "");
  });

  it("texto curto demais volta como veio", () => {
    assert.equal(label("2026-10"), "2026-10");
  });
});

describe("todayISO, nowTime e isPastSlot (relógio simulado, fuso de Brasília)", () => {
  // Brasília é UTC−3 o ano todo: 10h30 no espaço são 13h30 UTC, em qualquer máquina.
  beforeEach(() => {
    mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 14, 13, 30) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it("todayISO usa a data do espaço em YYYY-MM-DD", () => {
    assert.equal(todayISO(), "2026-10-14");
  });

  it("todayISO completa mês e dia com zero", () => {
    mock.timers.setTime(Date.UTC(2026, 0, 5, 11, 0));
    assert.equal(todayISO(), "2026-01-05");
  });

  it("nowTime usa a hora do espaço em HH:mm", () => {
    assert.equal(nowTime(), "10:30");
    mock.timers.setTime(Date.UTC(2026, 9, 14, 10, 5));
    assert.equal(nowTime(), "07:05");
  });

  it("isPastSlot sem data não checa nada", () => {
    assert.equal(isPastSlot(undefined, "08:00"), false);
    assert.equal(isPastSlot("", "08:00"), false);
  });

  it("isPastSlot compara a data com hoje", () => {
    assert.equal(isPastSlot("2026-10-13", "23:59"), true);
    assert.equal(isPastSlot("2026-10-15", "00:00"), false);
  });

  it("isPastSlot hoje compara o horário com agora", () => {
    assert.equal(isPastSlot("2026-10-14", "10:29"), true);
    assert.equal(isPastSlot("2026-10-14", "10:30"), false);
    assert.equal(isPastSlot("2026-10-14", "11:00"), false);
  });

  it("isPastSlot hoje sem horário não é passado", () => {
    assert.equal(isPastSlot("2026-10-14", ""), false);
  });
});

describe("elapsedLabel", () => {
  const now = Date.UTC(2026, 9, 22, 15, 0, 0);
  const minutesAgo = (m: number) => now - m * 60_000;

  it("minutos, horas e dias desde a atualização", () => {
    assert.equal(elapsedLabel(minutesAgo(0), now), "agora mesmo");
    assert.equal(elapsedLabel(now - 59_000, now), "agora mesmo");
    assert.equal(elapsedLabel(minutesAgo(5), now), "há 5 min");
    assert.equal(elapsedLabel(minutesAgo(59), now), "há 59 min");
    assert.equal(elapsedLabel(minutesAgo(60), now), "há 1 h");
    assert.equal(elapsedLabel(minutesAgo(60 * 23), now), "há 23 h");
    assert.equal(elapsedLabel(minutesAgo(60 * 24), now), "há 1 dia");
    assert.equal(elapsedLabel(minutesAgo(60 * 24 * 3), now), "há 3 dias");
  });

  it("instante no futuro conta como agora", () => {
    assert.equal(elapsedLabel(now + 120_000, now), "agora mesmo");
  });
});

describe("dateInSpace: dia no fuso do espaço (Brasil)", () => {
  it("pagamento às 21h41 de Brasília é do mesmo dia, não do dia seguinte em UTC", () => {
    // 23/10 21:41 em Brasília = 24/10 00:41 UTC (achado 60).
    assert.equal(dateInSpace("2026-10-24T00:41:00.000Z"), "2026-10-23");
    assert.equal(new Date("2026-10-24T00:41:00.000Z").toISOString().slice(0, 10), "2026-10-24");
  });

  it("de manhã em UTC ainda é o dia anterior em Brasília só até as 3h", () => {
    assert.equal(dateInSpace("2026-10-24T02:59:00.000Z"), "2026-10-23");
    assert.equal(dateInSpace("2026-10-24T03:00:00.000Z"), "2026-10-24");
  });

  it("aceita Date e data sem hora", () => {
    assert.equal(dateInSpace(new Date("2026-10-24T00:41:00.000Z")), "2026-10-23");
    assert.equal(dateInSpace("2026-10-05"), "2026-10-05");
  });
});

describe("fuso do espaço: os quatro fusos do Brasil", () => {
  afterEach(() => setSpaceTimeZoneProvider(undefined));

  it("o mesmo instante cai em dias diferentes conforme o fuso", () => {
    // 24/10 02:30 UTC: 23h30 em Brasília, 22h30 em Manaus, 21h30 no Acre, 0h30 em Noronha.
    const instant = "2026-10-24T02:30:00.000Z";
    assert.equal(dateInSpace(instant, "America/Sao_Paulo"), "2026-10-23");
    assert.equal(dateInSpace(instant, "America/Manaus"), "2026-10-23");
    assert.equal(dateInSpace(instant, "America/Rio_Branco"), "2026-10-23");
    assert.equal(dateInSpace(instant, "America/Noronha"), "2026-10-24");
  });

  it("hoje e agora seguem o fuso do espaço atual", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-24T02:30:00.000Z") });
    try {
      setSpaceTimeZoneProvider(() => "America/Rio_Branco");
      assert.equal(todayISO(), "2026-10-23");
      assert.equal(nowTime(), "21:30");
      setSpaceTimeZoneProvider(() => "America/Noronha");
      assert.equal(todayISO(), "2026-10-24");
      assert.equal(nowTime(), "00:30");
      // Fuso desconhecido: Brasília.
      setSpaceTimeZoneProvider(() => "Europe/Lisbon");
      assert.equal(nowTime(), "23:30");
    } finally {
      mock.timers.reset();
    }
  });

  it("o dia do espaço começa à meia-noite local, em UTC", () => {
    assert.equal(startOfDayInSpace("2026-10-23", "America/Sao_Paulo"), "2026-10-23T03:00:00.000Z");
    assert.equal(startOfDayInSpace("2026-10-23", "America/Manaus"), "2026-10-23T04:00:00.000Z");
    assert.equal(startOfDayInSpace("2026-10-23", "America/Rio_Branco"), "2026-10-23T05:00:00.000Z");
    assert.equal(startOfDayInSpace("2026-10-23", "America/Noronha"), "2026-10-23T02:00:00.000Z");
  });

  it("o dia do espaço termina antes da meia-noite local seguinte", () => {
    assert.equal(endOfDayInSpace("2026-10-23", "America/Sao_Paulo"), "2026-10-24T02:59:59.999Z");
    assert.equal(endOfDayInSpace("2026-10-31", "America/Rio_Branco"), "2026-11-01T04:59:59.999Z");
  });

  it("o fuso vem da escolha, senão do estado da unidade, senão Brasília", () => {
    assert.equal(resolveSpaceTimeZone({ timeZone: "America/Noronha" }, { state: "AM" }), "America/Noronha");
    assert.equal(resolveSpaceTimeZone({}, { state: "am" }), "America/Manaus");
    assert.equal(resolveSpaceTimeZone(undefined, { state: "AC" }), "America/Rio_Branco");
    assert.equal(resolveSpaceTimeZone(undefined, "Rua sem estado"), "America/Sao_Paulo");
    assert.equal(timeZoneForState("MS"), "America/Manaus");
    assert.equal(timeZoneForState("PE"), "America/Sao_Paulo");
  });
});
