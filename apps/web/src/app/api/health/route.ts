import { APP_COMMIT, APP_VERSION } from "@/config/release";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Saude do app para o monitor externo de disponibilidade (doc technical/27):
 * 200 quando o app responde e o banco atende em ate 5 s; 503 se nao. Publica,
 * sem dado pessoal nem mensagem de erro do banco.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 5_000;

async function databaseOk(): Promise<boolean> {
  const query = createSupabaseAdminClient()
    .from("organizations")
    .select("id")
    .limit(1)
    .then(({ error }) => !error);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DB_TIMEOUT_MS));
  try {
    return await Promise.race([query, timeout]);
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  const started = Date.now();
  const database = await databaseOk();
  return Response.json(
    { ok: database, database: database ? "ok" : "fail", version: APP_VERSION, commit: APP_COMMIT, ms: Date.now() - started },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
