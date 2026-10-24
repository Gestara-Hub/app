import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("posição dos avisos (achados 11 e 31)", () => {
  it("ficam no topo, longe do rodapé das janelas e do botão do contrato", () => {
    const layout = readFileSync(fileURLToPath(new URL("../layout.tsx", import.meta.url)), "utf8");
    expect(layout).toMatch(/<Toaster position="top-center"/);
    expect(layout).not.toMatch(/position="bottom/);
  });
});
