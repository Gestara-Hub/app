import { apiError } from "@gestarahub/core/api-error";
import { createSupabaseServerClient } from "./server";

/**
 * Cliente do Supabase da sessao (RLS pelo usuario autenticado). Sem sessao
 * valida, recusa: nunca cai no cliente administrativo, que ignora o RLS (doc 15,
 * fatia 3). Quem precisa do administrativo (cron, webhook) usa
 * `createSupabaseAdminClient` de forma explicita.
 */
export async function getClientForTenant() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) throw apiError("FORBIDDEN", "Sua sessão expirou. Entre de novo.", { httpStatus: 401 });
  return serverClient;
}
