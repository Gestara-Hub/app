import { describe, expect, it } from "vitest";
import { clampPage, likePattern, normalizeSearch, pickOption } from "../filter-input";

describe("filtros do endereço", () => {
  it("limpa e limita o texto de busca", () => {
    expect(normalizeSearch(undefined)).toBe("");
    expect(normalizeSearch("  ana  ")).toBe("ana");
    expect(normalizeSearch("a".repeat(150))).toHaveLength(100);
  });

  it("escapa curingas do ilike e ignora busca vazia", () => {
    expect(likePattern("")).toBeNull();
    expect(likePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });

  it("aceita só opções da lista", () => {
    expect(pickOption("tier", ["tier", "all"] as const)).toBe("tier");
    expect(pickOption("x'; drop", ["tier", "all"] as const)).toBeUndefined();
    expect(pickOption(undefined, ["tier"] as const)).toBeUndefined();
  });

  it("limita a página à última existente", () => {
    expect(clampPage(5, 30, 25)).toBe(2);
    expect(clampPage(1, 0, 25)).toBe(1);
    expect(clampPage(0, 30, 25)).toBe(1);
    expect(clampPage(2, 30, 25)).toBe(2);
  });
});
