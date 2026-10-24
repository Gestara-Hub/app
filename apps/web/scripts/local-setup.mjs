#!/usr/bin/env node
/**
 * Prepara o ambiente local do Supabase de uma vez:
 *
 *   pnpm setup:local          sobe o Supabase e aplica as migracoes pendentes
 *   pnpm setup:local:reset    zera o banco local e aplica tudo do zero (APAGA OS DADOS LOCAIS)
 *
 * Passos:
 * 1. Confere o Docker e sobe o Supabase local (`supabase start`) se estiver parado.
 * 2. Aplica as migracoes pendentes (`supabase migration up`) ou zera o banco
 *    (`supabase db reset`, que tambem roda o seed) com --reset.
 * 3. Preenche no apps/web/.env.local as variaveis do Supabase local que faltarem
 *    (URL, chave anonima e service role), sem mexer nas que ja existem.
 * 4. Prepara o cron diario: CRON_SECRET no .env.local e app_url/cron_secret no Vault
 *    (o mesmo que `pnpm cron:local`).
 * 5. Recria o espaco de demonstracao no banco (o mesmo que `pnpm demo:local`):
 *    DEMO_PASSWORD no .env.local e os usuarios e dados da Academia X (pulado com --no-demo).
 *
 * Nunca imprime chaves nem segredos. Depois: `pnpm dev` (e `pnpm tunnel` para o
 * webhook do Asaas).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENV_FILE = resolve(ROOT, "apps/web/.env.local");
const SUPABASE = ["--workdir", "apps"];
const reset = process.argv.includes("--reset");
const noDemo = process.argv.includes("--no-demo");

const step = (n, text) => console.log(`\n${n}. ${text}`);
const fail = (text) => {
  console.error(`\nErro: ${text}`);
  process.exit(1);
};

/** Roda um comando sem mostrar a saida (pode conter chaves); em erro, mostra so o fim. */
function quiet(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`
      .split("\n")
      .filter((l) => l.trim() && !/key|secret|token|jwt/i.test(l))
      .slice(-8)
      .join("\n");
    fail(`${cmd} ${args.join(" ")} falhou:\n${out}`);
  }
  return r.stdout ?? "";
}

// 1. Docker e Supabase
step(1, "Docker e Supabase local");
if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  fail("o Docker não está rodando. Abra o Docker Desktop e tente de novo.");
}
if (spawnSync("supabase", ["--version"], { stdio: "ignore" }).status !== 0) {
  fail("Supabase CLI não encontrado. Instale com: brew install supabase/tap/supabase");
}
const running = spawnSync("supabase", ["status", ...SUPABASE], { cwd: ROOT, stdio: "ignore" }).status === 0;
if (running) {
  console.log("   Supabase local já está no ar.");
} else {
  console.log("   Subindo o Supabase local (a primeira vez demora)...");
  quiet("supabase", ["start", ...SUPABASE]);
  console.log("   Supabase local no ar.");
}

// 2. Banco
if (reset) {
  step(2, "Zerando o banco local e aplicando todas as migrações (os dados locais são apagados)");
  quiet("supabase", ["db", "reset", ...SUPABASE]);
  console.log("   Banco recriado, migrações e seed aplicados.");
} else {
  step(2, "Aplicando as migrações pendentes");
  const out = quiet("supabase", ["migration", "up", ...SUPABASE]);
  const applied = (out.match(/Applying migration [^\s]+/g) ?? []).map((l) => l.replace("Applying migration ", ""));
  console.log(applied.length ? applied.map((m) => `   aplicada: ${m}`).join("\n") : "   Nenhuma migração pendente.");
}

// 3. Variaveis do Supabase no .env.local (so as que faltam)
step(3, "Variáveis do Supabase local no apps/web/.env.local");
const status = Object.fromEntries(
  quiet("supabase", ["status", ...SUPABASE, "-o", "env"])
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const wanted = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
};
let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const added = [];
for (const [key, value] of Object.entries(wanted)) {
  if (!value) continue;
  if (new RegExp(`^${key}=.+$`, "m").test(env)) continue;
  env = new RegExp(`^${key}=.*$`, "m").test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
    : `${env.replace(/\n*$/, "\n")}${key}=${value}\n`;
  added.push(key);
}
if (added.length) writeFileSync(ENV_FILE, env);
console.log(added.length ? `   preenchidas: ${added.join(", ")}` : "   Já estavam preenchidas (não foram alteradas).");

// 4. Cron diario: CRON_SECRET e Vault
step(4, "Cron diário (CRON_SECRET e Vault)");
execFileSync(process.execPath, [resolve(ROOT, "apps/web/scripts/dev-cron-secrets.mjs")], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "inherit"],
})
  .toString()
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("Para testar"))
  .forEach((l) => console.log(`   ${l}`));

// 5. Demonstracao no banco
if (noDemo) {
  step(5, "Espaço de demonstração");
  console.log("   Pulado (--no-demo). Para criar depois: pnpm demo:local.");
} else {
  step(5, "Espaço de demonstração (Academia X)");
  execFileSync(process.execPath, [resolve(ROOT, "apps/web/scripts/dev-demo.mjs")], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  })
    .toString()
    .split("\n")
    .filter((l) => l.trim())
    .forEach((l) => console.log(`   ${l}`));
}

console.log(`
Pronto. Agora:
  pnpm dev       sobe o app (reinicie se ele já estava rodando e alguma variável foi criada)
  pnpm tunnel    só para testar o webhook do Asaas (pagamentos)${reset ? "\n  Depois do reset, saia e entre de novo no app (a sessão antiga aponta para dados apagados)." : ""}`);
