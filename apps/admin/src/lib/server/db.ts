import "server-only";
import postgres from "postgres";
import { getEnv } from "./env";

/**
 * Conexao direta de Postgres com o papel `platform_app` (doc technical/26,
 * secao 4): le o `public` so onde ha politica para ele e escreve so no schema
 * `platform`. Nunca usa a chave `service_role`. Uma conexao por processo.
 */
const globalForDb = globalThis as unknown as { __platformSql?: postgres.Sql };

export function sql(): postgres.Sql {
  if (!globalForDb.__platformSql) {
    globalForDb.__platformSql = postgres(getEnv().PLATFORM_DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      // O pooler do Supabase em modo transacao nao aceita comandos preparados.
      prepare: false,
      onnotice: () => {},
    });
  }
  return globalForDb.__platformSql;
}
