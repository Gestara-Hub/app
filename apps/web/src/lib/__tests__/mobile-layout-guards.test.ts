import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regras de layout que o celular cobra caro e o computador nao mostra.
 * `sr-only` direto numa <table>: a tabela ignora a largura de 1px, estica ate o
 * conteudo e, absoluta, vaza da tela; o celular entao afasta o zoom da pagina
 * inteira (Financeiro, 11/11/2026). O `sr-only` vai num <div> em volta.
 */
const SRC = fileURLToPath(new URL("../..", import.meta.url));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

describe("layout no celular", () => {
  it("nenhuma <table> leva sr-only direto", () => {
    const offenders = tsxFiles(SRC).filter((file) => /<table[^>]*className="[^"]*\bsr-only\b/.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([]);
  });
});
