import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dayPosition,
  daysOverlap,
  earlyBirdActive,
  eventStage,
  eventTotalHours,
  suggestedRegistrationPrice,
} from "../src/events.ts";

const days = [
  { date: "2026-11-15", start: "09:00", end: "12:00" },
  { date: "2026-11-15", start: "14:00", end: "17:30" },
  { date: "2026-11-16", start: "09:00", end: "12:00", status: "canceled" as const },
  { date: "2026-11-17", start: "09:00", end: "11:00" },
];

describe("eventos: situacao e carga horaria", () => {
  it("antes, durante e depois pelas datas nao canceladas", () => {
    assert.equal(eventStage(days, "2026-11-14"), "upcoming");
    assert.equal(eventStage(days, "2026-11-15"), "ongoing");
    assert.equal(eventStage(days, "2026-11-17"), "ongoing");
    assert.equal(eventStage(days, "2026-11-18"), "finished");
    assert.equal(eventStage([], "2026-11-18"), "upcoming");
  });

  it("soma as horas dos dias que contam", () => {
    assert.equal(eventTotalHours(days), 8.5);
  });

  it("blocos do mesmo dia que se cruzam", () => {
    assert.equal(daysOverlap(days[0], { date: "2026-11-15", start: "11:00", end: "13:00" }), true);
    assert.equal(daysOverlap(days[0], days[1]), false);
    assert.equal(daysOverlap(days[0], days[3]), false);
  });
});

describe("eventos: preco sugerido", () => {
  const fixed = { billingMode: "fixed" as const, priceCents: 30000, earlyBirdPriceCents: 25000, earlyBirdUntil: "2026-11-01" };

  it("lote ate a data, cheio depois", () => {
    assert.equal(earlyBirdActive(fixed, "2026-11-01"), true);
    assert.equal(earlyBirdActive(fixed, "2026-11-02"), false);
    assert.equal(suggestedRegistrationPrice(fixed, "full", 3, "2026-10-20"), 25000);
    assert.equal(suggestedRegistrationPrice(fixed, "full", 3, "2026-11-05"), 30000);
  });

  it("sem lote configurado vale o cheio", () => {
    assert.equal(suggestedRegistrationPrice({ billingMode: "fixed", priceCents: 30000 }, "full", 3, "2026-10-20"), 30000);
  });

  it("por dia multiplica os dias; sem cobranca e zero", () => {
    const perDay = { billingMode: "per_day" as const, dayPriceCents: 8000 };
    assert.equal(suggestedRegistrationPrice(perDay, "days", 2, "2026-10-20"), 16000);
    assert.equal(suggestedRegistrationPrice(perDay, "full", 3, "2026-10-20"), 24000);
    assert.equal(suggestedRegistrationPrice({ billingMode: "free" }, "full", 3, "2026-10-20"), 0);
  });
});

describe("dayPosition (dia 3 de 3, 12/11/2026)", () => {
  const evDays = [
    { id: "d3", date: "2026-11-12", start: "09:00", end: "12:00" },
    { id: "d1", date: "2026-11-10", start: "09:00", end: "12:00" },
    { id: "dx", date: "2026-11-11", start: "09:00", end: "12:00", status: "canceled" as const },
    { id: "d2", date: "2026-11-11", start: "14:00", end: "17:00" },
  ];
  it("conta só os dias valendo, em ordem de data e hora", () => {
    assert.deepEqual(dayPosition(evDays, "d1"), { position: 1, total: 3 });
    assert.deepEqual(dayPosition(evDays, "d3"), { position: 3, total: 3 });
  });
  it("dia cancelado ou que não existe: null", () => {
    assert.equal(dayPosition(evDays, "dx"), null);
    assert.equal(dayPosition(evDays, "nada"), null);
  });
});
