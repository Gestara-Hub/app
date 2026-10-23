"use server";

import type { UserPreferences } from "@gestarahub/contracts";
import { mergeUserPreferences } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { logError } from "@/lib/log";

export async function getUserPreferencesFromDb(
  userId: string,
): Promise<UserPreferences | null> {
  try {
    const client = await getClientForTenant();
    const { data, error } = await client
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
  } catch (err) {
    logError("[preferencesBackend] Falha ao consultar preferências:", err);
    return null;
  }
}

export async function saveUserPreferencesInDb(
  userId: string,
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const client = await getClientForTenant();

  const existing = await getUserPreferencesFromDb(userId);
  const updated = mergeUserPreferences(existing, preferences);

  const { error } = await client
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        preferences: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    logError("[preferencesBackend] Erro ao salvar preferências do usuário:", error);
    throw new Error("Erro ao salvar preferências no banco de dados.");
  }

  return updated;
}
