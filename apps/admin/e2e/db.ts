import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Cópia de src/test/local.ts para o Playwright (que roda em CommonJS e não aceita import.meta).
 * Apoio dos testes de banco: o Supabase local (chaves lidas do `supabase status`
 * na hora, nunca impressas) e uma conexao de dono do banco para montar e
 * limpar os cenarios. O painel em si so usa o papel `platform_app`.
 */
const ROOT = resolve(__dirname, "../../..");

let cached: Record<string, string> | undefined;

function status(): Record<string, string> {
  if (cached) return cached;
  const out = execFileSync("supabase", ["status", "--workdir", "apps", "-o", "env"], { cwd: ROOT, encoding: "utf8" });
  cached = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => [m[1], m[2]]),
  );
  return cached;
}

/** Conexao de dono do banco (so para preparar e limpar os testes). */
export function ownerSql() {
  return postgres(status().DB_URL, { max: 1, onnotice: () => {} });
}

/** Conexao exatamente como o painel faz: papel `platform_app`. */
export function panelSql() {
  const url = process.env.PLATFORM_DATABASE_URL;
  if (!url) throw new Error("PLATFORM_DATABASE_URL ausente (rode pnpm admin:setup).");
  return postgres(url, { max: 1, onnotice: () => {} });
}

export function authAdmin(): SupabaseClient {
  return createClient(status().API_URL, status().SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(status().API_URL, status().ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@teste.gestarahub.local`;
export const TEST_PASSWORD = "Senha-de-teste-123!";

/**
 * Limpa a auditoria que os proprios testes criaram (e so ela). A tabela nao
 * deixa apagar nem para o dono: o gatilho e desligado so aqui, na mesma
 * transacao, e volta na hora.
 */
export async function purgeAudit(owner: ReturnType<typeof ownerSql>, adminIds: string[], extraWhere = "false") {
  await owner.begin(async (tx) => {
    await tx.unsafe("alter table platform.audit_logs disable trigger audit_logs_no_update");
    await tx`delete from platform.audit_logs where admin_id = any(${adminIds}::uuid[]) or action like 'teste.%' or ${tx.unsafe(extraWhere)}`;
    await tx.unsafe("alter table platform.audit_logs enable trigger audit_logs_no_update");
  });
}
