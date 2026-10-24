#!/usr/bin/env node
/**
 * Reinicia o segundo fator de um administrador do painel (recuperacao de conta
 * quando se perde o aplicativo autenticador):
 *
 *   pnpm admin:reset-mfa -- --email voce@exemplo.com [--yes]
 *
 * Remove os aplicativos autenticadores da pessoa; no proximo login (senha) o
 * painel pede o cadastro de um novo QR. So roda com acesso a infraestrutura
 * (chave de servico do Auth e conexao do painel), e deixa registro na auditoria.
 * No local usa o Supabase local; em outro ambiente informe ADMIN_SUPABASE_URL e
 * ADMIN_SERVICE_ROLE_KEY. Nunca imprime senha, segredo nem chave.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const ADMIN = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(ADMIN, "../..");

const fail = (text) => {
  console.error(`\nErro: ${text}`);
  process.exit(1);
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readEnvFile() {
  const file = resolve(ADMIN, ".env.local");
  if (!existsSync(file)) fail("apps/admin/.env.local não existe. Rode `pnpm admin:setup`.");
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}

function ask(question) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolveAnswer(answer);
    });
  });
}

const email = (arg("email") ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("informe --email com o e-mail do administrador.");

let supabaseUrl = process.env.ADMIN_SUPABASE_URL;
let serviceKey = process.env.ADMIN_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  const status = spawnSync("supabase", ["status", "--workdir", "apps", "-o", "env"], { cwd: ROOT, encoding: "utf8" });
  if (status.status !== 0) fail("sem Supabase local no ar e sem ADMIN_SUPABASE_URL/ADMIN_SERVICE_ROLE_KEY.");
  const env = Object.fromEntries(
    (status.stdout ?? "")
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  supabaseUrl = env.API_URL;
  serviceKey = env.SERVICE_ROLE_KEY;
}
const databaseUrl = readEnvFile().PLATFORM_DATABASE_URL;
if (!supabaseUrl || !serviceKey || !databaseUrl) fail("configuração incompleta (URL, chave ou conexão do painel).");

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const [admin] = await sql`select id, auth_user_id, name, role, status from platform.admins where lower(email) = ${email}`;
  if (!admin) fail("não existe administrador do painel com este e-mail.");

  const auth = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await auth.auth.admin.mfa.listFactors({ userId: admin.auth_user_id });
  if (error) fail(`não foi possível ler os aplicativos autenticadores (${error.message}).`);

  console.log(`\nAdministrador: ${admin.name} (${admin.role}, ${admin.status}). Aplicativos cadastrados: ${data.factors.length}.`);
  if (process.argv.includes("--yes") === false) {
    const answer = (await ask("Remover o segundo fator desta pessoa? (digite sim) ")).trim().toLowerCase();
    if (answer !== "sim") fail("cancelado, nada foi alterado.");
  }

  for (const factor of data.factors) {
    const result = await auth.auth.admin.mfa.deleteFactor({ id: factor.id, userId: admin.auth_user_id });
    if (result.error) fail(`não foi possível remover um aplicativo (${result.error.message}).`);
  }
  await sql`
    insert into platform.audit_logs (admin_id, admin_name, action, target)
    values (${admin.id}, ${"script reset-mfa"}, 'admin.mfa_reset', ${sql.json({ adminId: admin.id, email, removed: data.factors.length, via: "script" })})`;
  console.log(`\nPronto: ${data.factors.length} aplicativo(s) removido(s). No próximo login, o painel pede o cadastro de um novo QR.`);
} finally {
  await sql.end();
}
