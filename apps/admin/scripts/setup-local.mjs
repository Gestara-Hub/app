#!/usr/bin/env node
/**
 * Prepara o painel admin no ambiente local (doc technical/26, fase 0):
 *
 *   pnpm admin:setup
 *
 * 1. Confere o Supabase local e aplica as migracoes pendentes (schema `platform`).
 * 2. Define a senha do papel `platform_app` (a conexao direta do painel).
 * 3. Cria o apps/admin/.env.local com o que faltar (URL e chave anonima do
 *    Supabase, conexao do painel e segredo da sessao), sem mexer no que existe.
 *
 * Nunca imprime chaves, senhas nem segredos. Depois: `pnpm admin:create-admin`.
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ADMIN = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(ADMIN, "../..");
const ENV_FILE = resolve(ADMIN, ".env.local");
const SUPABASE = ["--workdir", "apps"];

const fail = (text) => {
  console.error(`\nErro: ${text}`);
  process.exit(1);
};

function run(args) {
  const r = spawnSync("supabase", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: r.stdout ?? "" };
}

console.log("1. Supabase local e migrações");
if (spawnSync("supabase", ["--version"], { stdio: "ignore" }).status !== 0) fail("Supabase CLI não encontrado.");
const status = run(["status", ...SUPABASE, "-o", "env"]);
if (!status.ok) fail("o Supabase local não está no ar. Rode `pnpm setup:local` antes.");
const env = Object.fromEntries(
  status.out
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!env.API_URL || !env.ANON_KEY || !env.DB_URL) fail("não consegui ler a configuração do Supabase local.");
const migration = run(["migration", "up", ...SUPABASE]);
if (!migration.ok) fail("`supabase migration up` falhou.");
console.log("   Migrações em dia.");

console.log("2. Papel do painel no banco");
const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const has = (name) => new RegExp(`^${name}=.+$`, "m").test(current);
const set = (name, value) => {
  const line = `${name}=${value}`;
  return new RegExp(`^${name}=.*$`, "m").test(content) ? content.replace(new RegExp(`^${name}=.*$`, "m"), line) : `${content.replace(/\n*$/, "\n")}${line}\n`;
};
let content = current;
const additions = [];

if (!has("PLATFORM_DATABASE_URL")) {
  const password = randomBytes(24).toString("base64url");
  if (!/^[A-Za-z0-9_-]+$/.test(password)) fail("senha gerada fora do formato esperado.");
  const sql = postgres(env.DB_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`alter role platform_app login password '${password}'`);
  } finally {
    await sql.end();
  }
  const url = new URL(env.DB_URL);
  additions.push(["PLATFORM_DATABASE_URL", `postgresql://platform_app:${password}@${url.host}${url.pathname}`]);
  console.log("   Senha do papel platform_app definida.");
} else {
  console.log("   Já configurado no .env.local.");
}
if (!has("NEXT_PUBLIC_SUPABASE_URL")) additions.push(["NEXT_PUBLIC_SUPABASE_URL", env.API_URL]);
if (!has("NEXT_PUBLIC_SUPABASE_ANON_KEY")) additions.push(["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.ANON_KEY]);
if (!has("ADMIN_SESSION_SECRET")) additions.push(["ADMIN_SESSION_SECRET", randomBytes(48).toString("base64url")]);
if (!has("ADMIN_ENV_LABEL")) additions.push(["ADMIN_ENV_LABEL", "local"]);
if (!has("ADMIN_SERVICE_ROLE_KEY") && env.SERVICE_ROLE_KEY) additions.push(["ADMIN_SERVICE_ROLE_KEY", env.SERVICE_ROLE_KEY]);
if (!has("CRON_SECRET")) additions.push(["CRON_SECRET", randomBytes(24).toString("base64url")]);

console.log("3. Arquivo .env.local");
for (const [name, value] of additions) content = set(name, value);
if (additions.length > 0) {
  writeFileSync(ENV_FILE, content, { mode: 0o600 });
  console.log(`   Preenchido: ${additions.map(([name]) => name).join(", ")}.`);
} else {
  console.log("   Nada a preencher.");
}
console.log("\nPronto. Crie o primeiro administrador: pnpm admin:create-admin");
