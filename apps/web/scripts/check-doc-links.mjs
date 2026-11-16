#!/usr/bin/env node
/**
 * Confere as referencias a docs:
 *  1. links relativos `[texto](caminho.md)` em docs/**\/*.md;
 *  2. caminhos `docs/...` citados em docs, regras do projeto, skills, codigo e testes;
 *  3. atalhos `technical/NN`, `product/NN`, `frontend/NN`, `guides/NN`, `archive/...`
 *     (ex.: "doc technical/17"): precisa existir um arquivo `NN-*` na pasta.
 *
 * Uso (da raiz do repositorio):  node apps/web/scripts/check-doc-links.mjs
 * Sai com codigo 1 e lista cada problema (arquivo:linha) se achar algum.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const docsDir = join(root, "docs");

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-e2e", "dist", "test-results", "playwright-report", "capturas", ".git"]);
const CODE_EXT = /\.(ts|tsx|mjs|js|json|md|sql|css)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (CODE_EXT.test(entry.name)) out.push(path);
  }
  return out;
}

const sourceRoots = [
  join(root, "docs"),
  join(root, "apps/web/src"),
  join(root, "apps/web/e2e"),
  join(root, "apps/web/scripts"),
  join(root, "apps/supabase/migrations"),
  join(root, "packages"),
  join(root, ".claude"),
];
const files = [
  ...sourceRoots.filter(existsSync).flatMap((dir) => walk(dir)),
  ...["CLAUDE.md", "AGENTS.md"].map((name) => join(root, name)).filter(existsSync),
];

const problems = [];
const report = (file, line, message) => problems.push(`${relative(root, file)}:${line}  ${message}`);

const folderFiles = new Map();
function filesOfFolder(folder) {
  if (!folderFiles.has(folder)) {
    const dir = join(docsDir, folder);
    folderFiles.set(folder, existsSync(dir) ? readdirSync(dir) : []);
  }
  return folderFiles.get(folder);
}

for (const file of files) {
  const inDocs = file.startsWith(docsDir);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, index) => {
    const line = index + 1;

    // 1. Links relativos dentro de docs/**/*.md
    if (inDocs && file.endsWith(".md")) {
      for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1].split("#")[0];
        // `/rota` é tela do app (artigos de docs/ajuda); quem confere é o teste help-search.
        if (!target || /^(https?:|mailto:|#|\/)/.test(target)) continue;
        if (!existsSync(resolve(dirname(file), target))) report(file, line, `link quebrado: ${match[1]}`);
      }
    }

    // 2. Caminhos docs/... (com ou sem .md)
    // Planos de handoff citam arquivos que ainda vao nascer (2026-10-xx...): nao entram.
    const isHandoff = file.startsWith(join(docsDir, "handoff")) || file.startsWith(join(docsDir, "archive", "handoff-"));
    for (const match of text.matchAll(/(?<![\w/.-])docs\/((?:technical|product|frontend|guides|archive|qa|handoff|skills)\/[\w.-]+(?:\/[\w.-]+)*)/g)) {
      if (isHandoff) break;
      const raw = match[1].replace(/[.,;:)]+$/, "");
      // Evidencias locais de QA ficam no .gitignore e nao existem em checkouts limpos (CI).
      if (raw === "qa/capturas" || raw.startsWith("qa/capturas/")) continue;
      const shortcut = raw.match(/^(technical|product|frontend|guides)\/(\d{2})$/);
      if (shortcut) {
        // "docs/technical/05" e atalho de numero, nao de arquivo.
        if (!filesOfFolder(shortcut[1]).some((name) => name.startsWith(`${shortcut[2]}-`))) {
          report(file, line, `atalho sem arquivo: docs/${raw}`);
        }
        continue;
      }
      const candidates = [raw, `${raw}.md`];
      if (!candidates.some((c) => existsSync(join(docsDir, c)))) report(file, line, `caminho inexistente: docs/${raw}`);
    }

    // 3. Atalhos "technical/17", "product/25"... (so quando nao fazem parte de um caminho maior).
    // Planos de handoff descrevem os caminhos de antes e de depois: nao entram.
    if (isHandoff) return;
    for (const match of text.matchAll(/(?<![\w/.-])(technical|product|frontend|guides)\/(\d{2})(?![\w-])/g)) {
      const [, folder, number] = match;
      if (!filesOfFolder(folder).some((name) => name.startsWith(`${number}-`))) {
        report(file, line, `atalho sem arquivo: ${folder}/${number}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`${problems.length} problema(s) de referencia a docs:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Referencias a docs conferidas em ${files.length} arquivos: nenhum problema.`);
