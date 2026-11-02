#!/usr/bin/env node
/**
 * Comeca do zero num comando so (02/11/2026):
 *
 *   pnpm reset:all            zera o banco local, segredos do cron e demonstracao
 *   pnpm reset:all --no-demo  o mesmo, sem recriar o espaco de demonstracao
 *
 * Roda, em ordem, os scripts que ja existem:
 * 1. setup:local:reset  (supabase db reset: APAGA OS DADOS LOCAIS, migra, seed)
 * 2. cron:local         (CRON_SECRET e Vault, zerado junto com o banco)
 * 3. demo:local         (espaco de demonstracao), a menos que --no-demo
 *
 * O tunel e o pnpm dev ficam de fora: sao processos que ficam no ar, cada um
 * no seu terminal. O script lembra a ordem no fim.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const noDemo = process.argv.includes("--no-demo");

const steps = [
  ["Banco local do zero", ["setup:local:reset"]],
  ["Segredos do cron", ["cron:local"]],
  ...(noDemo ? [] : [["Espaço de demonstração", ["demo:local"]]]),
];

for (const [label, args] of steps) {
  console.log(`\n== ${label}: pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nParou em "${label}" (código ${result.status ?? "?"}). Corrija e rode de novo.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`
Pronto. Agora, cada um no seu terminal e nesta ordem:
  1. pnpm tunnel   (webhooks do Asaas; grava a URL no .env.local)
  2. pnpm dev      (só depois de o túnel subir: o Next lê o .env.local ao iniciar)
Depois, saia e entre de novo no app: a sessão antiga não vale no banco novo.`);
