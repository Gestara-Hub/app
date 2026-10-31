import { describe, expect, it } from "vitest";
import { STICKY_TOP_OFFSET, listStartScrollTop } from "../list-scroll";

// Paginacao embaixo: trocar de pagina leva a tela ao inicio da lista, abaixo do topo fixo.

describe("voltar ao início da lista ao trocar de página", () => {
  it("lista começando acima da tela: sobe até ela, descontando o topo fixo", () => {
    expect(listStartScrollTop(400, 1800)).toBe(400 - STICKY_TOP_OFFSET);
  });

  it("início da lista ainda à vista: não mexe na tela", () => {
    expect(listStartScrollTop(400, 200)).toBeNull();
    expect(listStartScrollTop(400, 400 - STICKY_TOP_OFFSET)).toBeNull();
  });

  it("lista no alto da página: no máximo até o topo, nunca negativo", () => {
    expect(listStartScrollTop(30, 900)).toBe(0);
  });
});
