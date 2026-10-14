import { describe, expect, it } from "vitest";
import { BRAZIL_STATES, normalizeStateUf } from "@/lib/brazil-states";

describe("BRAZIL_STATES", () => {
  it("tem as 27 UFs, sem repetir", () => {
    expect(BRAZIL_STATES).toHaveLength(27);
    expect(new Set(BRAZIL_STATES.map((s) => s.uf)).size).toBe(27);
  });

  it("toda UF tem 2 letras maiusculas", () => {
    for (const state of BRAZIL_STATES) {
      expect(state.uf).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe("normalizeStateUf", () => {
  it.each([
    ["SP", "SP"],
    ["sp", "SP"],
    ["  rj ", "RJ"],
    ["São Paulo", "SP"],
    ["sao paulo", "SP"],
    ["SAO PAULO", "SP"],
    ["Distrito Federal", "DF"],
    ["espirito santo", "ES"],
  ])("%j vira %j", (value, expected) => {
    expect(normalizeStateUf(value)).toBe(expected);
  });

  it("texto que nao e estado vira vazio", () => {
    expect(normalizeStateUf("qwer")).toBe("");
    expect(normalizeStateUf("XX")).toBe("");
    expect(normalizeStateUf("Paulo")).toBe("");
  });

  it("vazio, null e undefined viram vazio", () => {
    expect(normalizeStateUf("")).toBe("");
    expect(normalizeStateUf("   ")).toBe("");
    expect(normalizeStateUf(null)).toBe("");
    expect(normalizeStateUf(undefined)).toBe("");
  });
});
