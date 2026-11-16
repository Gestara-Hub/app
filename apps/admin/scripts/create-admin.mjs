#!/usr/bin/env node
/**
 * Cadastra um administrador do painel (doc technical/26, secao 3):
 *
 *   pnpm admin:create-admin -- --email voce@exemplo.com --name "Seu Nome" [--role platform_owner]
 *
 * Pede a senha sem mostrar na tela (12+ caracteres). Cria a conta de login com
 * o marcador `platform` (que o app dos clientes recusa) e a linha em
 * `platform.admins`. No local usa o Supabase local; em outro ambiente informe
 * ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY e PLATFORM_DATABASE_URL (a chave
 * so existe neste comando). Nunca imprime senha nem chave.
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
const ROLES = ["platform_owner", "platform_support", "platform_finance", "platform_viewer"];

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

function ask(question, { hidden = false } = {}) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolveAnswer(answer);
    });
  });
}

const email = (arg("email") ?? "").trim().toLowerCase();
const name = (arg("name") ?? "").trim();
const role = arg("role") ?? "platform_owner";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("informe --email com um e-mail válido.");
if (name.length < 2) fail('informe --name "Seu Nome".');
if (!ROLES.includes(role)) fail(`--role precisa ser um de: ${ROLES.join(", ")}.`);

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
const databaseUrl = process.env.PLATFORM_DATABASE_URL || readEnvFile().PLATFORM_DATABASE_URL;
if (!supabaseUrl || !serviceKey || !databaseUrl) fail("configuração incompleta (URL, chave ou conexão do painel).");

const password = await ask("Senha (12+ caracteres): ", { hidden: true });
const confirm = await ask("Repita a senha: ", { hidden: true });
if (password !== confirm) fail("as senhas não conferem.");
if (password.length < 12) fail("a senha precisa ter 12 ou mais caracteres.");

const auth = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const [{ taken }] = await sql`select exists(select 1 from platform.admins where lower(email) = ${email}) as taken`;
  if (taken) fail("já existe um administrador com este e-mail.");

  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { platform: true },
    user_metadata: { name },
  });
  if (error || !data.user) fail(`não foi possível criar o login (${error?.message ?? "sem resposta"}).`);

  try {
    const [row] = await sql`
      insert into platform.admins (auth_user_id, name, email, role, status)
      values (${data.user.id}, ${name}, ${email}, ${role}, 'active') returning id`;
    await sql`
      insert into platform.audit_logs (admin_id, admin_name, action, target)
      values (${row.id}, ${"script create-admin"}, 'admin.created', ${sql.json({ email, role })})`;
  } catch (err) {
    // Sem a linha do painel o login nao serve: desfaz.
    await auth.auth.admin.deleteUser(data.user.id);
    fail(`não foi possível cadastrar o administrador (${err.message}).`);
  }
  const panelUrl = process.env.ADMIN_PUBLIC_URL || "http://localhost:3201";
  console.log(`\nAdministrador cadastrado: ${email} (${role}). Entre em ${panelUrl} e configure o aplicativo autenticador.`);
} finally {
  await sql.end();
}
