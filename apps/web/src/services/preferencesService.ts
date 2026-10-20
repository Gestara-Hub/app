import type { UserPreferences } from "@gestarahub/contracts";
import { DEFAULT_USER_PREFERENCES, mergeUserPreferences } from "@gestarahub/contracts";
import { simulateRead, simulateWrite } from "@/mocks/helpers";
import { isSupabaseOrganization } from "@/lib/session";
import { store } from "@/mocks/store";
import { getUserPreferencesFromDb, saveUserPreferencesInDb } from "./preferencesBackend";

export const PREFERENCES_STORAGE_KEY = "gestarahub_user_preferences";

export const preferencesService = {
  getPreferences(userId?: string): Promise<UserPreferences> {
    return simulateRead(async () => {
      if (userId && isSupabaseOrganization(store.organization.id)) {
        const remote = await getUserPreferencesFromDb(userId);
        if (remote) return remote;
      }
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
          if (raw) {
            return mergeUserPreferences(null, JSON.parse(raw));
          }
        } catch {
          // ignore storage error
        }
      }
      return { ...DEFAULT_USER_PREFERENCES };
    });
  },

  updatePreferences(
    userId: string | undefined,
    partial: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    return simulateWrite(async () => {
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
          const current = raw ? JSON.parse(raw) : null;
          const merged = mergeUserPreferences(current, partial);
          window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore storage error
        }
      }

      if (userId && isSupabaseOrganization(store.organization.id)) {
        return saveUserPreferencesInDb(userId, partial);
      }

      return mergeUserPreferences(null, partial);
    });
  },

  resetPreferences(userId?: string): Promise<UserPreferences> {
    return simulateWrite(async () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            PREFERENCES_STORAGE_KEY,
            JSON.stringify(DEFAULT_USER_PREFERENCES),
          );
        } catch {
          // ignore storage error
        }
      }

      if (userId && isSupabaseOrganization(store.organization.id)) {
        return saveUserPreferencesInDb(userId, DEFAULT_USER_PREFERENCES);
      }

      return { ...DEFAULT_USER_PREFERENCES };
    });
  },
};
