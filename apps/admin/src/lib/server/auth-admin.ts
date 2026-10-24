import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

/**
 * Unico modulo do painel que usa a chave de servico do Supabase, e so para o
 * Auth: criar o login de quem foi convidado, gerar o link de convite, reiniciar
 * o segundo fator e desfazer um login sem uso. Nunca le nem grava dados de
 * espaco (isso e do papel `platform_app`). Sem a chave, o convite fica desligado.
 */
export class AuthAdminUnavailable extends Error {
  constructor() {
    super("O convite de administradores não está configurado neste ambiente.");
  }
}

function client() {
  const env = getEnv();
  if (!env.ADMIN_SERVICE_ROLE_KEY) throw new AuthAdminUnavailable();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.ADMIN_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function inviteEnabled(): boolean {
  return Boolean(getEnv().ADMIN_SERVICE_ROLE_KEY);
}

/** Cria o login (sem senha conhecida, com o marcador de plataforma) e devolve o id. */
export async function createLogin(input: { email: string; name: string }): Promise<string> {
  const { data, error } = await client().auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    app_metadata: { platform: true },
    user_metadata: { name: input.name },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message ?? "sem resposta"}`);
  return data.user.id;
}

/** Link de uso unico para a pessoa criar a senha. O codigo nunca e gravado nem registrado em log. */
export async function inviteLink(email: string): Promise<string> {
  const { data, error } = await client().auth.admin.generateLink({ type: "recovery", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) throw new Error(`generateLink: ${error?.message ?? "sem resposta"}`);
  return `${getEnv().ADMIN_PUBLIC_URL}/accept?token_hash=${encodeURIComponent(hash)}`;
}

export async function deleteLogin(authUserId: string): Promise<void> {
  await client().auth.admin.deleteUser(authUserId);
}

/** Desliga o codigo por e-mail da pessoa (o marcador fica no `app_metadata`, que so o servidor grava). */
export async function clearEmailTwoFactor(authUserId: string): Promise<void> {
  const { error } = await client().auth.admin.updateUserById(authUserId, { app_metadata: { two_factor_email: false } });
  if (error) throw new Error(`updateUserById: ${error.message}`);
}

/** Remove os apps autenticadores da pessoa: no proximo login ela cadastra um novo. */
export async function resetFactors(authUserId: string): Promise<number> {
  const supabase = client();
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: authUserId });
  if (error) throw new Error(`listFactors: ${error.message}`);
  for (const factor of data.factors) {
    const result = await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId: authUserId });
    if (result.error) throw new Error(`deleteFactor: ${result.error.message}`);
  }
  return data.factors.length;
}
