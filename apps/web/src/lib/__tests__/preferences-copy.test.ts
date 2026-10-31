import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "../theme-accent";

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Palavras de programador ou em inglês que o usuário final não deve ver (achado 69, doc 08). */
const JARGON = ["Copiar CSS", "Raio", "Feedback Operacional", "Check-in", "(Default)", "r:{state", "System (Nativo)"];

describe("textos de Preferências sem jargão (achado 69)", () => {
  it("as telas de Preferências e do tema não trazem as palavras proibidas", () => {
    for (const file of ["../../features/preferences/components/user-preferences-view.tsx"]) {
      const text = source(file);
      for (const word of JARGON) expect(text, `${file}: ${word}`).not.toContain(word);
    }
  });

  it("as cores de destaque têm nome em português e um cinza só (o padrão)", () => {
    expect(THEME_COLORS[0]).toMatchObject({ name: "zinc", label: "Padrão" });
    expect(THEME_COLORS.map((c) => c.label)).toContain("Violeta");
    expect(THEME_COLORS.some((c) => ["slate", "stone", "gray", "neutral"].includes(c.name))).toBe(false);
  });
});
