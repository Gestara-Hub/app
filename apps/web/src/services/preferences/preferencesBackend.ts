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

/**
 * Campos conhecidos das preferencias. O resto do pedido e descartado, e um
 * pedido grande demais e recusado (revisao geral de 31/10/2026, achado S13: a
 * rota guardava qualquer chave, de qualquer tamanho).
 */
const PREFERENCE_KEYS: ReadonlySet<string> = new Set<keyof UserPreferences>([
  "theme",
  "accentColor",
  "sidebarCollapsed",
  "density",
  "viewModes",
  "pageSizes",
  "defaultPageSize",
  "audioFeedbackEnabled",
  "checkinSound",
  "lastSeenRelease",
  "onboarding",
  "dismissedAlertKeys",
  "reminderSnoozes",
  "bellSeenKeys",
  "urgentSeenKeys",
  "securityPrompt",
  "accountMenuTip",
  "lastUnitId",
  "defaultCalendarView",
  "themeStyling",
]);
const MAX_PREFERENCES_BYTES = 64 * 1024;

/** Sem sessao do banco: `null` (as preferencias ficam so no navegador). */
export async function saveMyPreferencesAction(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
  const userId = await sessionUserId();
  if (!userId) return null;
  if (JSON.stringify(preferences ?? {}).length > MAX_PREFERENCES_BYTES) {
    throw new Error("Preferências grandes demais.");
  }
  const known = Object.fromEntries(
    Object.entries(preferences ?? {}).filter(([key]) => PREFERENCE_KEYS.has(key)),
  ) as Partial<UserPreferences>;
  const updated = mergeUserPreferences(await readPreferences(userId), known);
  const { error } = await createSupabaseAdminClient()
    .from("user_preferences")
    .upsert({ user_id: userId, preferences: updated, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    logError("[preferencesBackend] Erro ao salvar preferências do usuário:", error);
    throw new Error("Erro ao salvar preferências no banco de dados.");
  }
  return updated;
}
