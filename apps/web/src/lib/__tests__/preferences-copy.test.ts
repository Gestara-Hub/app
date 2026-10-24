import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_FONTS, THEME_PRESETS } from "../theme-customizer";

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Palavras de programador ou em inglês que o usuário final não deve ver (achado 69, doc 08). */
const JARGON = ["Copiar CSS", "Raio", "Feedback Operacional", "Check-in", "(Default)", "r:{state", "System (Nativo)"];

describe("textos de Preferências sem jargão (achado 69)", () => {
  it("as telas de Preferências e do tema não trazem as palavras proibidas", () => {
    for (const file of [
      "../../features/preferences/components/user-preferences-view.tsx",
      "../../components/theme/theme-customizer.tsx",
    ]) {
      const text = source(file);
      for (const word of JARGON) expect(text, `${file}: ${word}`).not.toContain(word);
    }
  });

  it("os nomes dos temas e das fontes estão em português", () => {
    expect(THEME_PRESETS.find((p) => p.id === "default")?.name).toBe("Padrão");
    expect(THEME_FONTS.find((f) => f.value === "system")?.label).toBe("Do aparelho");
    expect(THEME_FONTS.find((f) => f.value === "mono")?.label).toBe("Monoespaçada");
  });
});
