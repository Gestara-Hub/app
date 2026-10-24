import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("janela Matricular alunos (achado 36)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../components/enroll-students-dialog.tsx", import.meta.url)),
    "utf8",
  );

  it("o rodapé tem Cancelar, como as outras janelas (doc 07)", () => {
    const footer = source.slice(source.indexOf("<DialogFooter"));
    expect(footer).toMatch(/Cancelar\s*<\/Button>/);
  });

  it("a lista de alunos cresce com a altura da janela, sem caixa fixa baixa", () => {
    expect(source).not.toContain("max-h-72");
    expect(source).toContain("100dvh");
  });
});
