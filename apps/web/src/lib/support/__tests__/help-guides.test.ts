import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchScore, normalizeLabel, stepLabels } from "../guide-match";
import { HELP_CHUNKS, routePath } from "../help-search";

const SRC = fileURLToPath(new URL("../../..", import.meta.url));
const KINDS = ["botão", "aba", "campo", "menu", "item", "texto", "card", "lista"];

function files(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" || entry.name === "node_modules" ? [] : files(path, test);
    return test(entry.name) ? [path] : [];
  });
}

/** Rotas estáticas do app (`src/app/(app)/.../page.tsx`). */
const PAGES = new Set(
  files(join(SRC, "app/(app)"), (name) => name === "page.tsx").map((file) => {
    const route = file
      .slice(join(SRC, "app/(app)").length)
      .replace(/\/page\.tsx$/, "")
      .replace(/\([^)]*\)\/?/g, "");
    return route === "" ? "/" : route;
  }),
);

// Todo o texto do código de tela, para conferir que o rótulo do passo existe de verdade.
const SOURCE = normalizeLabel(
  files(SRC, (name) => /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".d.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n"),
);

const GUIDED = HELP_CHUNKS.filter((chunk) => chunk.guide);

describe("casamento do texto do guia com a tela", () => {
  it("ignora acento, maiúscula, asterisco e dois-pontos", () => {
    expect(normalizeLabel("Nome*")).toBe("nome");
    expect(normalizeLabel("  Matrícula:  ")).toBe("matricula");
  });

  it("prefere o texto igual, depois o que começa com o rótulo, depois palavras inteiras", () => {
    const labels = stepLabels({ label: "Novo aluno" });
    expect(matchScore("Novo aluno", labels)).toBe(3);
    expect(matchScore("+ Novo aluno", labels)).toBe(3);
    expect(matchScore("Novo aluno agora", labels)).toBe(2);
    expect(matchScore("Cadastrar novo aluno hoje", labels)).toBe(1);
    expect(matchScore("Novos alunos", labels)).toBe(0);
    // Contador colado ao rótulo (aba com número) ainda casa; palavra maior não.
    expect(matchScore("Pagas7", stepLabels({ label: "Pagas" }))).toBe(2);
    expect(matchScore("Pagamentos", stepLabels({ label: "Pagas" }))).toBe(0);
  });

  it("aceita mais de um rótulo com barra", () => {
    const labels = stepLabels({ label: "Adicionar|Salvar" });
    expect(matchScore("Salvar", labels)).toBe(3);
    expect(matchScore("Cancelar", labels)).toBe(0);
  });

  it("não escolhe um bloco grande que só contém o rótulo", () => {
    expect(matchScore(`Aluno ${"texto ".repeat(30)}`, stepLabels({ label: "Aluno" }))).toBe(0);
  });
});

describe("guias na tela dos artigos de docs/ajuda", () => {
  it("há guias escritos", () => {
    expect(GUIDED.length).toBeGreaterThan(0);
  });

  it.each(GUIDED.map((chunk) => [chunk.id, chunk] as const))("%s: rota, passos e rótulos existem", (_id, chunk) => {
    const guide = chunk.guide!;
    expect(PAGES.has(routePath(guide.route)), `rota ${guide.route} não é uma tela do app`).toBe(true);
    expect(guide.steps.length).toBeGreaterThanOrEqual(1);
    expect(guide.steps.length).toBeLessThanOrEqual(8);
    for (const step of guide.steps) {
      expect(KINDS).toContain(step.kind);
      expect(step.text.length, `texto longo no passo "${step.label}"`).toBeLessThanOrEqual(160);
      const found = stepLabels(step).some((label) => SOURCE.includes(label));
      expect(found, `o texto "${step.label}" não está em nenhuma tela do código (mudou o rótulo?)`).toBe(true);
    }
  });
});
