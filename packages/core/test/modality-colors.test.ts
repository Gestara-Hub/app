import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODALITY_COLORS, modalityColorKeys, nextModalityColor } from "../src/modality-colors.ts";

/** Cor da modalidade, versao 2 (doc product/29 §Calendario). */
const m = (id: string, createdAt: string, color?: string) => ({ id, createdAt, ...(color ? { color: color as never } : {}) });

describe("modalityColorKeys", () => {
  it("sem cor salva, segue a ordem de criacao (igual a versao 1)", () => {
    const keys = modalityColorKeys([m("b", "2026-02-01"), m("a", "2026-01-01"), m("c", "2026-03-01")]);
    assert.deepEqual([...keys.entries()], [["a", "blue"], ["b", "emerald"], ["c", "amber"]]);
  });

  it("a cor salva vale; as outras continuam pela ordem", () => {
    const keys = modalityColorKeys([m("a", "2026-01-01", "rose"), m("b", "2026-02-01")]);
    assert.equal(keys.get("a"), "rose");
    assert.equal(keys.get("b"), "emerald");
  });
});

describe("nextModalityColor", () => {
  it("a primeira cor que ninguem usa", () => {
    assert.equal(nextModalityColor([]), "blue");
    assert.equal(nextModalityColor([m("a", "2026-01-01", "blue"), m("b", "2026-02-01", "amber")]), "emerald");
  });

  it("conta a cor das antigas sem cor salva", () => {
    // "a" mostra azul pela ordem: a nova nao repete.
    assert.equal(nextModalityColor([m("a", "2026-01-01")]), "emerald");
  });

  it("todas usadas: segue a ordem e repete", () => {
    const all = MODALITY_COLORS.map((c, i) =>
      m(`m${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`, c),
    );
    assert.equal(nextModalityColor(all), "blue");
    assert.equal(nextModalityColor([...all, m("x", "2026-02-01", "blue")]), "emerald");
  });
});
