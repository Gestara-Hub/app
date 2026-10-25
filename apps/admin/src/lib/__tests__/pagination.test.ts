import { describe, expect, it } from "vitest";
import { pageInfo, parsePage, rangeLabel } from "../pagination";

describe("paginação das listas", () => {
  it("lê a página do endereço com piso 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("4")).toBe(4);
  });

  it("calcula páginas, faixa e próxima", () => {
    expect(pageInfo(1, 0)).toMatchObject({ totalPages: 1, from: 0, to: 0, hasNext: false });
    expect(pageInfo(1, 25)).toMatchObject({ totalPages: 1, from: 1, to: 25, hasNext: false });
    expect(pageInfo(1, 26)).toMatchObject({ totalPages: 2, from: 1, to: 25, hasNext: true });
    expect(pageInfo(2, 26)).toMatchObject({ from: 26, to: 26, hasNext: false });
  });

  it("escreve o resumo da faixa", () => {
    expect(rangeLabel(pageInfo(1, 0), "espaço", "espaços")).toBe("Nenhum espaço");
    expect(rangeLabel(pageInfo(1, 1), "espaço", "espaços")).toBe("1 espaço");
    expect(rangeLabel(pageInfo(1, 12), "espaço", "espaços")).toBe("12 espaços");
    expect(rangeLabel(pageInfo(2, 60), "espaço", "espaços")).toBe("Mostrando 26 a 50 de 60 espaços");
  });
});
