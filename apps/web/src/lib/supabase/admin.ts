import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo do Supabase (server-only, usa `SUPABASE_SERVICE_ROLE_KEY`).
 * Ignora RLS — usado exclusivamente em Server Actions controladas (ex.: emissao e
 * validacao de tokens de cadastro de 24h, criacao de usuario + organizacao no
 * primeiro acesso e sincronizacao do setup).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.",
    );
  }

  // Um cliente por processo (11/11/2026): eram dezenas por chamada (um por tabela
  // ao carregar o espaco). Nao guarda sessao (nunca entra com usuario por ele),
  // entao pode ser dividido. A chave inclui o ambiente (testes trocam as variaveis).
  const cacheKey = `${url}|${serviceRoleKey}`;
  if (cached?.key !== cacheKey) {
    cached = {
      key: cacheKey,
      client: createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    };
  }
  return cached.client;
}

let cached: { key: string; client: SupabaseClient } | undefined;
