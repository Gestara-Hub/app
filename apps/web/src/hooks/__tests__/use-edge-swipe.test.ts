import { describe, expect, it } from "vitest";
import { EDGE_SWIPE_DISTANCE, EDGE_SWIPE_ZONE, edgeSwipeResult } from "../use-edge-swipe";

/** Arrastar da borda esquerda abre o menu; com ele aberto, para a esquerda fecha. */
describe("edgeSwipeResult", () => {
  const edge = { x: EDGE_SWIPE_ZONE - 5, y: 300 };

  it("da borda para a direita abre o menu fechado", () => {
    expect(edgeSwipeResult(edge, { x: edge.x + EDGE_SWIPE_DISTANCE, y: 310 }, false)).toBe("open");
  });

  it("longe da borda, ou curto, ou mais na vertical, nada", () => {
    expect(edgeSwipeResult({ x: 120, y: 300 }, { x: 260, y: 300 }, false)).toBe("none");
    expect(edgeSwipeResult(edge, { x: edge.x + 10, y: 300 }, false)).toBe("none");
    expect(edgeSwipeResult(edge, { x: edge.x + 60, y: 400 }, false)).toBe("none");
  });

  it("com o menu aberto, para a esquerda fecha; para a direita, nada", () => {
    expect(edgeSwipeResult({ x: 200, y: 300 }, { x: 200 - EDGE_SWIPE_DISTANCE, y: 305 }, true)).toBe("close");
    expect(edgeSwipeResult({ x: 10, y: 300 }, { x: 90, y: 300 }, true)).toBe("none");
  });
});
