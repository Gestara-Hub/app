import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ModalityMeasure, StudentMeasurement } from "@gestarahub/contracts";
import {
  formatMeasureChange,
  formatMeasureValue,
  measureProgress,
  normalizeMeasureValue,
  validateMeasures,
} from "../src/measurements.ts";

const weight: ModalityMeasure = { id: "m-peso", name: "Peso", unit: "kg", better: "lower" };
const plank: ModalityMeasure = { id: "m-prancha", name: "Prancha", unit: "s", better: "higher" };

const entry = (date: string, values: Record<string, number>, createdAt = `${date}T12:00:00.000Z`): StudentMeasurement => ({
  id: `me-${date}-${createdAt}`,
  organizationId: "org",
  studentId: "ana",
  modalityId: "mod",
  date,
  values,
  createdBy: "usr",
  createdAt,
  updatedAt: createdAt,
});

describe("testes e medidas (fase B, 31/10/2026)", () => {
  it("valor: número com até duas casas, vírgula ou ponto, pode ser negativo", () => {
    assert.deepEqual(normalizeMeasureValue("72,5"), { ok: true, value: 72.5 });
    assert.deepEqual(normalizeMeasureValue("-3"), { ok: true, value: -3 });
    assert.equal(normalizeMeasureValue("1,234").ok, false);
    assert.equal(normalizeMeasureValue("abc").ok, false);
    assert.equal(normalizeMeasureValue("").ok, false);
  });

  it("lista de medidas: nome obrigatório, sem repetir, unidade curta e direção válida", () => {
    assert.deepEqual(validateMeasures([{ ...weight, name: " Peso ", unit: " kg " }]), { ok: true, value: [weight] });
    assert.equal(validateMeasures([{ ...weight, name: " " }]).ok, false);
    assert.deepEqual(validateMeasures([weight, { ...plank, name: "peso" }]), { ok: false, message: "A medida peso aparece duas vezes." });
    assert.equal(validateMeasures([{ ...weight, unit: "quilogramas" }]).ok, false);
    assert.equal(validateMeasures([{ ...weight, better: "sideways" as never }]).ok, false);
    // Unidade vazia vale (nota de dor de 0 a 10).
    assert.equal(validateMeasures([{ id: "m-dor", name: "Dor", unit: "", better: "lower" }]).ok, true);
  });

  it("evolução: última, anterior e primeira; melhorou pela direção da medida", () => {
    const history = [
      entry("2026-09-01", { "m-peso": 80, "m-prancha": 30 }),
      entry("2026-10-01", { "m-peso": 78.5 }),
      entry("2026-11-01", { "m-peso": 79, "m-prancha": 45 }),
    ];
    const [w, p] = measureProgress([weight, plank], history);
    assert.deepEqual(w.latest, { value: 79, date: "2026-11-01" });
    assert.deepEqual(w.previous, { value: 78.5, date: "2026-10-01" });
    assert.deepEqual(w.first, { value: 80, date: "2026-09-01" });
    assert.equal(w.change, 0.5);
    // Peso subiu: piorou (melhor descer).
    assert.equal(w.improved, false);
    // Prancha pula a avaliacao sem valor: 30 -> 45, melhorou.
    assert.equal(p.change, 15);
    assert.equal(p.improved, true);
  });

  it("uma avaliação só: sem mudança; sem nenhuma: vazio", () => {
    const [w] = measureProgress([weight], [entry("2026-09-01", { "m-peso": 80 })]);
    assert.equal(w.change, null);
    assert.equal(w.improved, null);
    const [empty] = measureProgress([weight], []);
    assert.equal(empty.latest, undefined);
  });

  it("formato em pt-BR", () => {
    assert.equal(formatMeasureValue(72.5, "kg"), "72,5 kg");
    assert.equal(formatMeasureValue(18, "%"), "18%");
    assert.equal(formatMeasureValue(7, ""), "7");
    assert.equal(formatMeasureChange(2.5, "kg"), "+2,5 kg");
    assert.equal(formatMeasureChange(-1, "s"), "−1 s");
  });
});
