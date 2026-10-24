import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("botão Extrato em PDF (achado 63)", () => {
  it("tem a seta de menu, porque abre a escolha do mês", () => {
    const source = readFileSync(fileURLToPath(new URL("../components/online-payments-view.tsx", import.meta.url)), "utf8");
    const menu = source.slice(source.indexOf("function StatementMenu"));
    expect(menu).toContain("Extrato em PDF");
    expect(menu).toContain("<ChevronDown");
  });
});
