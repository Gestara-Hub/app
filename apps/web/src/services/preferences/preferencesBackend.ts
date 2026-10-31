"use server";

import type { UserPreferences } from "@gestarahub/contracts";
import { isApiError, mergeUserPreferences } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/services/server/tenant";
import { logError } from "@/lib/log";

/**
 * Preferencias do usuario da sessao. O usuario vem da sessao do Supabase
 * (`requireTenant`), nunca do navegador: antes estas actions recebiam o id e a
 * tabela era aberta a todos, e qualquer um lia e trocava as preferencias de
 * outra pessoa (auditoria de 30/10/2026, migracao 69). Gravacao pela chave de
 * servico, presa ao usuario da sessao.
 */

async function sessionUserId(): Promise<string | null> {
  try {
    return (await requireTenant()).userId;
  } catch (err) {
    // Sem sessao do banco (demonstracao, antes do login): caso esperado, nao e erro.
    if (isApiError(err) && err.code === "FORBIDDEN") return null;
    throw err;
  }
}

async function readPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logError("[preferencesBackend] Erro ao buscar preferências do usuário:", error);
    return null;
  }
  if (!data?.preferences) return null;
  return mergeUserPreferences(null, data.preferences as Partial<UserPreferences>);
}

export async function getMyPreferencesAction(): Promise<UserPreferences | null> {
  try {
    const userId = await sessionUserId();
    return userId ? await readPreferences(userId) : null;
  } catch (err) {
    logError("[preferencesBackend] Falha ao consultar preferências:", err);
    return null;
  }
}

/** Sem sessao do banco: `null` (as preferencias ficam so no navegador). */
export async function saveMyPreferencesAction(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
  const userId = await sessionUserId();
  if (!userId) return null;
  const updated = mergeUserPreferences(await readPreferences(userId), preferences);
  const { error } = await createSupabaseAdminClient()
    .from("user_preferences")
    .upsert({ user_id: userId, preferences: updated, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    logError("[preferencesBackend] Erro ao salvar preferências do usuário:", error);
    throw new Error("Erro ao salvar preferências no banco de dados.");
  }
  return updated;
}
