import { apiError } from "@gestarahub/core/api-error";
import { isPlatformAdminUser } from "@/lib/security/platform-admin";
import { secondFactorState } from "@/lib/security/second-factor";
import { createSupabaseServerClient } from "./server";

/**
 * Cliente do Supabase da sessao (RLS pelo usuario autenticado). Sem sessao
 * valida, recusa: nunca cai no cliente administrativo, que ignora o RLS (doc 15,
 * fatia 3). Com a verificacao em duas etapas ligada, so a sessao que ja passou
 * pelo segundo fator (doc 17). Quem precisa do administrativo (cron, webhook) usa
 * `createSupabaseAdminClient` de forma explicita.
 */
export async function getClientForTenant() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  // Administrador da plataforma nunca opera um espaco (doc technical/26).
  if (!user || isPlatformAdminUser(user)) throw apiError("FORBIDDEN", "Sua sessão expirou. Entre de novo.", { httpStatus: 401 });
  // Verificacao em duas etapas ligada e codigo ainda nao digitado (doc 17): a
  // senha sozinha nao le nem grava nada.
  if ((await secondFactorState(serverClient, user)) === "missing") throw missingSecondFactor();
  return serverClient;
}

export function missingSecondFactor() {
  return apiError("FORBIDDEN", "Falta o código da verificação em duas etapas. Entre de novo.", { httpStatus: 401 });
}
