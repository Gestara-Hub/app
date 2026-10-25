#!/usr/bin/env node
/**
 * Gera o indice da central de ajuda (base do assistente do "Fale com a gente"):
 * le docs/ajuda/*.md, quebra cada artigo por `##` e grava
 * apps/web/src/lib/support/help-kb.generated.json.
 *
 *   pnpm --filter @gestarahub/web help:build           grava
 *   pnpm --filter @gestarahub/web help:build -- --check   confere (falha se estiver velho)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = resolve(ROOT, "docs/ajuda");
const OUT = resolve(ROOT, "apps/web/src/lib/support/help-kb.generated.json");

// Passo do guia na tela (linha `+ tipo "rótulo": texto` depois de `Guia: /rota`).
const STEP_LINE = /^\+\s+(botão|aba|campo|menu|item|texto)\s+"([^"]+)"\s*:\s*(.+)$/;

export function buildChunks() {
  const chunks = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
    const slug = file.replace(/\.md$/, "");
    const lines = readFileSync(resolve(DIR, file), "utf8").split("\n");
    const article = (lines.find((l) => l.startsWith("# ")) ?? `# ${slug}`).slice(2).trim();
    const route = lines.find((l) => l.startsWith("Onde: "))?.slice(6).trim();
    let current = null;
    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (current) chunks.push(current);
        const title = line.slice(3).trim();
        current = { id: `${slug}#${title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, article, title, ...(route ? { route } : {}), text: "" };
      } else if (current && line.startsWith("Guia: ")) {
        // Guia na tela: rota onde começa; os passos vêm nas linhas `+ ...` seguintes.
        current.guide = { route: line.slice(6).trim(), steps: [] };
      } else if (current && current.guide && line.startsWith("+ ")) {
        const match = STEP_LINE.exec(line.trim());
        if (!match) throw new Error(`Passo de guia inválido em ${file} (${current.title}): ${line}`);
        current.guide.steps.push({ kind: match[1], label: match[2], text: match[3].trim() });
      } else if (current && line.startsWith("Resumo: ") && current.text === "" && !current.summary) {
        // Descrição curta do card, escrita à mão; não entra no texto que abre no clique.
        current.summary = line.slice(8).trim();
      } else if (current && !line.startsWith("# ") && !line.startsWith("Onde: ")) {
        current.text += `${line}\n`;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text.length > 0);
}

const json = `${JSON.stringify(buildChunks(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const same = existsSync(OUT) && readFileSync(OUT, "utf8") === json;
  if (!same) {
    console.error("O índice da ajuda está desatualizado. Rode: pnpm --filter @gestarahub/web help:build");
    process.exit(1);
  }
  console.log("Índice da ajuda em dia.");
} else {
  writeFileSync(OUT, json);
  console.log(`Índice da ajuda gravado: ${JSON.parse(json).length} trechos.`);
}
