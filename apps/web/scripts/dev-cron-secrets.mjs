#!/usr/bin/env node
/**
 * Prepara o Supabase Cron local (migracao 26) para chamar o app:
 *
 *   pnpm cron:local
 *
 * 1. Cria CRON_SECRET em apps/web/.env.local, se ainda nao existir.
 * 2. Grava no Vault do banco local `app_url` (http://host.docker.internal:3000,
 *    o app visto de dentro do Docker) e `cron_secret` (o mesmo valor).
 *
 * Rode de novo depois de `supabase db reset` (o Vault e zerado junto) e
 * reinicie o pnpm dev se o CRON_SECRET acabou de ser criado.
 * So mexe na linha CRON_SECRET do .env.local e nunca imprime o segredo.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_gestarahub";
const APP_URL = process.env.CRON_APP_URL || `http://host.docker.internal:${process.env.PORT || "3200"}`;

let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
let secret = content.match(/^CRON_SECRET=(.+)$/m)?.[1]?.trim();
let created = false;
if (!secret) {
  secret = randomBytes(24).toString("hex");
  // Linha vazia (modelo do .env.example): preenche no lugar; sem a linha, acrescenta.
  content = /^CRON_SECRET=.*$/m.test(content)
    ? content.replace(/^CRON_SECRET=.*$/m, `CRON_SECRET=${secret}`)
    : `${content.replace(/\n*$/, "\n")}\n# Supabase Cron -> /api/cron/* (gerado por pnpm cron:local)\nCRON_SECRET=${secret}\n`;
  writeFileSync(ENV_FILE, content);
  created = true;
}

// Upsert no Vault: apaga e recria (os valores vao por variavel do psql, nao na linha de comando).
const sql = `
delete from vault.secrets where name in ('app_url', 'cron_secret');
select vault.create_secret(:'app_url', 'app_url');
select vault.create_secret(:'cron_secret', 'cron_secret');
`;
execFileSync(
  "docker",
  ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-q", "-v", "ON_ERROR_STOP=1",
    "-v", `app_url=${APP_URL}`, "-v", `cron_secret=${secret}`],
  { input: sql, stdio: ["pipe", "ignore", "inherit"] },
);

console.log(`Vault local: app_url = ${APP_URL} e cron_secret gravados.`);
console.log(created ? "CRON_SECRET criado no .env.local: reinicie o pnpm dev." : "CRON_SECRET já existia no .env.local.");
console.log("Para testar agora: select public.run_membership_charges_cron(); no banco local.");
