#!/usr/bin/env node
/**
 * Prepara uma versao para producao (doc technical/27). Nao faz commit, tag
 * nem push: so escreve os arquivos e diz os comandos.
 *
 * 1. Versao por data no fuso de Brasilia (2026.11.10; a segunda do dia vira
 *    2026.11.10-2) em apps/web e apps/admin.
 * 2. Changelog tecnico (CHANGELOG.md na raiz) com os commits desde a ultima tag,
 *    agrupados pelo tipo (feat, fix...).
 * 3. Confere se as Novidades para quem usa (features/releases/release-notes.ts)
 *    ja tem a entrada desta versao.
 *
 * Uso: pnpm release:prepare        (versao de hoje)
 *      pnpm release:prepare --dry  (so mostra, nao escreve)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = execSync("git rev-parse --show-toplevel").toString().trim();
const dry = process.argv.includes("--dry");
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();

// Dia em Brasilia, sem zero a esquerda (versao valida no package.json).
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date())
    .map((p) => [p.type, p.value]),
);
const base = `${Number(parts.year)}.${Number(parts.month)}.${Number(parts.day)}`;
const dateIso = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
const tags = new Set(git("tag --list 'v*'").split("\n").filter(Boolean));
let version = base;
for (let n = 2; tags.has(`v${version}`); n += 1) version = `${base}-${n}`;

// 1. Versao nos dois apps.
for (const app of ["apps/web", "apps/admin"]) {
  const file = join(root, app, "package.json");
  const text = readFileSync(file, "utf8");
  const next = text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`);
  if (!dry) writeFileSync(file, next);
}

// 2. Changelog tecnico.
let lastTag = "";
try {
  lastTag = git("describe --tags --abbrev=0 --match 'v*'");
} catch {
  lastTag = "";
}
const GROUPS = { feat: "Novo", fix: "Correções", perf: "Desempenho", refactor: "Reorganização", docs: "Documentação", test: "Testes", chore: "Manutenção" };
let body;
if (!lastTag) {
  body = "- Primeira versão marcada.";
} else {
  const subjects = git(`log ${lastTag}..HEAD --no-merges --pretty=%s`).split("\n").filter(Boolean);
  const grouped = {};
  for (const subject of subjects) {
    const type = /^(\w+)(\(|:|!)/.exec(subject)?.[1] ?? "outros";
    (grouped[type] ??= []).push(subject.replace(/^\w+(\([^)]*\))?!?:\s*/, (m) => (m.match(/\(([^)]*)\)/)?.[1] ?? "") + ": ").replace(/^: /, ""));
  }
  body = Object.entries(grouped)
    .map(([type, items]) => `### ${GROUPS[type] ?? "Outros"}\n\n${items.map((s) => `- ${s}`).join("\n")}`)
    .join("\n\n") || "- Sem commits desde a última versão.";
}
const changelogFile = join(root, "CHANGELOG.md");
const header = "# Changelog técnico\n\nGerado por `pnpm release:prepare` a partir dos commits (doc technical/27). As novidades para quem usa ficam em `apps/web/src/features/releases/release-notes.ts`.\n";
const previous = existsSync(changelogFile) ? readFileSync(changelogFile, "utf8").replace(header, "").trimStart() : "";
const section = `## ${version} (${dateIso})${lastTag ? `\n\nDesde ${lastTag}.` : ""}\n\n${body}\n`;
if (!dry) writeFileSync(changelogFile, `${header}\n${section}${previous ? `\n${previous}` : ""}`);

// 3. Novidades para quem usa.
const notes = readFileSync(join(root, "apps/web/src/features/releases/release-notes.ts"), "utf8");
const hasNotes = notes.includes(`version: "${version}"`);

console.log(`\nVersão ${version}${dry ? " (simulação, nada escrito)" : ""}`);
console.log(`- package.json de apps/web e apps/admin: ${version}`);
console.log(`- CHANGELOG.md: ${lastTag ? `commits desde ${lastTag}` : "primeira versão"}`);
console.log(
  hasNotes
    ? "- Novidades: entrada da versão encontrada."
    : `- Novidades: FALTA a entrada "${version}" em apps/web/src/features/releases/release-notes.ts (peça ao agente para redigir). Sem ela, ninguém vê o ponto de novidade.`,
);
// A versao se prepara na develop; a main (producao) recebe a develop inteira (13/11/2026, CLAUDE.md §6).
const branch = git("rev-parse --abbrev-ref HEAD");
if (branch !== "develop") console.log(`\nATENÇÃO: você está na "${branch}". A versão se prepara na develop.`);
console.log("\nDepois de revisar (na develop):");
console.log(`  git add -A && git commit -m "chore(release): ${version}"`);
console.log("  git push origin develop");
console.log("Migração nova? Rode `supabase db push --workdir apps` no banco de produção antes do próximo passo (guides/28).");
console.log("Publicar via PR develop -> main (sem squash, ou fast-forward direto; o merge na main dispara o deploy):");
console.log(`  gh pr merge --merge   # ou: git checkout main && git merge --ff-only develop && git push origin main`);
console.log("Tag na main e sincronizar develop de volta (mantém o próximo CHANGELOG.md exato):");
console.log("  git fetch origin && git checkout main && git pull --ff-only origin main");
console.log(`  git tag v${version} && git push origin v${version}`);
console.log("  git checkout develop && git merge --ff-only origin/main && git push origin develop\n");
