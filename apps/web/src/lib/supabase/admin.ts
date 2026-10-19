import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo do Supabase (server-only, usa `SUPABASE_SERVICE_ROLE_KEY`).
 * Ignora RLS — usado exclusivamente em Server Actions controladas (ex.: emissao e
 * validacao de tokens de cadastro de 24h, criacao de usuario + organizacao no
 * primeiro acesso e sincronizacao do setup).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
