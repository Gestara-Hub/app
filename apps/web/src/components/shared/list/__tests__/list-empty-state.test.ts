import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListEmptyState } from "../list-empty-state";

const base = {
  hasSearch: false,
  hasFilters: false,
  onClearSearch: () => undefined,
  onClearFilters: () => undefined,
  emptyGuide: createElement("p", null, "Nenhum profissional cadastrado ainda."),
};

const html = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ListEmptyState, { ...base, ...extra }));

describe("lista vazia com inativos (achado 21)", () => {
  it("sem ativo mas com inativo, diz isso e leva aos inativos", () => {
    const out = html({ inactiveLeft: { count: 1, noun: "Nenhum profissional", onShow: () => undefined } });
    expect(out).toContain("Nenhum profissional ativo no momento. Há 1 inativo.");
    expect(out).toContain("Ver inativos");
    expect(out).not.toContain("cadastrado ainda");
  });

  it("concorda no plural", () => {
    const out = html({ inactiveLeft: { count: 3, noun: "Nenhum profissional", onShow: () => undefined } });
    expect(out).toContain("Há 3 inativos.");
  });

  it("sem nenhum registro, continua o guia de primeiro cadastro", () => {
    const out = html({ inactiveLeft: { count: 0, noun: "Nenhum profissional", onShow: () => undefined } });
    expect(out).toContain("Nenhum profissional cadastrado ainda.");
  });
});
