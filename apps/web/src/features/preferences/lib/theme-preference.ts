import { mergeUserPreferences, type ThemeMode, type UserPreferences } from "@gestarahub/contracts";
import { PREFERENCES_STORAGE_KEY } from "@/services/preferences/preferencesService";

/**
 * Guarda o tema escolhido fora do app (botao da landing, 02/11/2026) no mesmo
 * lugar das preferencias da conta: no navegador sempre, e na conta quando ha
 * sessao. Sem isso, o provedor do app reaplicava o "Sistema" salvo na conta e
 * desfazia a escolha, inclusive em outra aba (o next-themes sincroniza abas).
 */
export async function saveThemePreference(theme: ThemeMode, options: { remote: boolean }): Promise<void> {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as Partial<UserPreferences>) : null;
    const next = mergeUserPreferences(current ? mergeUserPreferences(null, current) : null, { theme });
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sem localStorage: o next-themes ja guardou o tema do jeito dele
  }
  if (!options.remote) return;
  try {
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
      keepalive: true,
    });
  } catch {
    // sem rede: a conta recebe na proxima sincronizacao das preferencias
  }
}
