#!/usr/bin/env node
/**
 * e2e so da area mexida (doc 20): `pnpm e2e:area turmas` (ou varias: `turmas cobrancas`).
 * Sem area, lista as areas. Outros argumentos vao para o Playwright
 * (ex.: `pnpm e2e:area turmas -- --headed`). Desktop por padrao; `celular`
 * roda os specs de celular.
 */
import { spawnSync } from "node:child_process";

const AREAS = {
  acesso: ["acesso", "usuarios-perfis", "permissoes"],
  configuracao: ["configuracao-inicial", "areas-setup", "areas-settings", "configuracoes", "vocabulario-modalidade"],
  turmas: ["turmas", "turmas-geral", "curso-fechado"],
  chamada: ["turmas-geral", "turmas", "dinheiro-pacotes", "evolucao-areas"],
  alunos: ["cadastros", "ficha-aluno", "formularios"],
  evolucao: ["evolucao", "evolucao-areas", "notas"],
  cobrancas: ["mensalidades", "mensalidades-regras", "dinheiro-cobrancas", "dinheiro-avulsas", "cobranca-avulsa", "dinheiro-cursos", "dinheiro-pacotes"],
  financeiro: ["financeiro", "dinheiro-financeiro"],
  relatorios: ["relatorios", "dinheiro-financeiro"],
  comunicacao: ["comunicacao", "comunicacao-geral"],
  painel: ["painel", "painel-hoje"],
  auditoria: ["auditoria"],
  site: ["landing"],
  avisos: ["avisos-erros"],
  celular: ["mobile", "mobile-areas.mobile", "ficha-notas.mobile", "telas-dinheiro.mobile"],
};

const [, , ...args] = process.argv;
const split = args.indexOf("--");
const names = split >= 0 ? args.slice(0, split) : args;
const extra = split >= 0 ? args.slice(split + 1) : [];

if (names.length === 0 || names.some((name) => !AREAS[name])) {
  const unknown = names.filter((name) => !AREAS[name]);
  if (unknown.length) console.error(`Área desconhecida: ${unknown.join(", ")}\n`);
  console.log("Uso: pnpm e2e:area <área> [<área>...] [-- <opções do Playwright>]\n");
  for (const [name, specs] of Object.entries(AREAS)) console.log(`  ${name.padEnd(13)} ${specs.join(", ")}`);
  process.exit(names.length === 0 ? 0 : 1);
}

const specs = [...new Set(names.flatMap((name) => AREAS[name]))];
const mobile = names.includes("celular");
const files = specs.map((spec) => `e2e/${spec}.spec.ts`);
const project = mobile && names.length === 1 ? "mobile" : "desktop";
const result = spawnSync("npx", ["playwright", "test", ...files, `--project=${project}`, ...extra], { stdio: "inherit" });
process.exit(result.status ?? 1);
