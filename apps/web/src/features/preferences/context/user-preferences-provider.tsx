"use client";

import { setSeenMarksFromAccount, setSeenMarksPersister } from "@/lib/seen-marks";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import type { UserPreferences } from "@gestarahub/contracts";
import { DEFAULT_USER_PREFERENCES, mergeUserPreferences } from "@gestarahub/contracts";
import { PREFERENCES_STORAGE_KEY } from "@/services/preferences/preferencesService";
import {
  applyThemeColorFromServer,
  isThemeSyncingFromServer,
  resetThemeColor,
  subscribeToThemeColor,
} from "@/lib/theme-accent";
import { logWarn } from "@/lib/log";

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  resetPreferences: () => Promise<void>;
  isDirty: boolean;
  /** As preferencias do servidor ja chegaram (ou falharam): decidir so depois disto o que depende delas. */
  remoteLoaded: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function getInitialPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      return mergeUserPreferences(null, JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return DEFAULT_USER_PREFERENCES;
}

const DEBOUNCE_DELAY_MS = 60_000; // 1 minuto de inatividade após mudança
const MAX_WAIT_MS = 180_000; // teto máximo de 3 minutos

/**
 * Dono da copia local das preferencias (26/11/2026). A copia no navegador e de
 * uma conta so: entrar com outra conta no mesmo navegador herdava as marcas da
 * anterior (o aviso da verificacao em duas etapas abria no 1o acesso de uma
 * conta nova, pelos "7 dias de uso" da conta antiga).
 */
const PREFERENCES_OWNER_KEY = "gestarahub_user_preferences_owner";

/** Do aparelho, nao da conta: segue com quem entrar (tema, cores, densidade, menu). */
function deviceOnly(prefs: UserPreferences): UserPreferences {
  return mergeUserPreferences(null, {
    theme: prefs.theme,
    accentColor: prefs.accentColor,
    themeStyling: prefs.themeStyling,
    density: prefs.density,
    sidebarCollapsed: prefs.sidebarCollapsed,
  });
}

export function UserPreferencesProvider({ children, ownerId }: { children: ReactNode; ownerId?: string }) {
  const [preferences, setPreferences] = useState<UserPreferences>(getInitialPreferences);
  const [isDirty, setIsDirty] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  const pendingRef = useRef<Partial<UserPreferences>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const firstChangeTimeRef = useRef<number | null>(null);
  const isDirtyRef = useRef(false);

  // Enviar alterações acumuladas para o backend
  const flushToServer = useCallback(async () => {
    if (!isDirtyRef.current || Object.keys(pendingRef.current).length === 0) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    firstChangeTimeRef.current = null;

    const payload = { ...pendingRef.current };
    pendingRef.current = {};
    isDirtyRef.current = false;
    setIsDirty(false);

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      logWarn("[UserPreferencesProvider] Falha ao sincronizar preferências com o servidor:", err);
    }
  }, []);

  // Agendar sincronização com debounce + maxWait
  const scheduleSync = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);

    const now = Date.now();
    if (!firstChangeTimeRef.current) {
      firstChangeTimeRef.current = now;
    }

    // Se já passou do tempo máximo de espera, envia imediatamente
    if (now - firstChangeTimeRef.current >= MAX_WAIT_MS) {
      flushToServer();
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      flushToServer();
    }, DEBOUNCE_DELAY_MS);
  }, [flushToServer]);

  // Atualizar preferências localmente (0 ms) e agendar sincronização
  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPreferences((prev) => {
        const next = mergeUserPreferences(prev, partial);
        try {
          window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      pendingRef.current = { ...pendingRef.current, ...partial };
      scheduleSync();
    },
    [scheduleSync],
  );

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      updatePreferences({ [key]: value });
    },
    [updatePreferences],
  );

  const resetPreferences = useCallback(async () => {
    resetThemeColor();
    setPreferences(DEFAULT_USER_PREFERENCES);
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(DEFAULT_USER_PREFERENCES));
    } catch {
      // ignore
    }
    pendingRef.current = { ...DEFAULT_USER_PREFERENCES };
    await flushToServer();
  }, [flushToServer]);

  // O tema salvo na conta vale no app quando chega ou muda (carga, outro
  // aparelho, Preferencias). So nesses momentos: reaplicar a cada diferenca
  // desfazia o botao da landing, inclusive em outra aba, porque o next-themes
  // sincroniza as abas pelo armazenamento (02/11/2026).
  const { theme: activeTheme, setTheme } = useTheme();
  const appliedThemeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!preferences.theme || appliedThemeRef.current === preferences.theme) return;
    appliedThemeRef.current = preferences.theme;
    if (preferences.theme !== activeTheme) setTheme(preferences.theme);
  }, [preferences.theme, activeTheme, setTheme]);

  // Marcas de "ja vi" (25/11/2026; lib/seen-marks): a conta e a verdade. Cada
  // marca grava na hora (sem a espera de 1 minuto), para valer no outro aparelho.
  useEffect(() => {
    setSeenMarksPersister((patch) => {
      updatePreferences({ seen: patch });
      void flushToServer();
    });
    return () => setSeenMarksPersister(null);
  }, [updatePreferences, flushToServer]);
  useEffect(() => {
    setSeenMarksFromAccount(preferences.seen, remoteLoaded);
  }, [preferences.seen, remoteLoaded]);

  // Carga inicial remota (hidratação silenciosa)
  useEffect(() => {
    let active = true;

    async function loadRemotePreferences() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const data = await res.json();
        // Copia local de outra conta: so o que e do aparelho continua. Copia
        // antiga sem dono vale para quem ja tem preferencias na conta (a mesma
        // pessoa de sempre); conta nova nao herda nada.
        let owner: string | null = null;
        try {
          owner = window.localStorage.getItem(PREFERENCES_OWNER_KEY);
        } catch {
          // sem storage
        }
        const sameOwner = !ownerId || owner === ownerId || (!owner && Boolean(data?.preferences));
        if (active && ownerId) {
          try {
            window.localStorage.setItem(PREFERENCES_OWNER_KEY, ownerId);
          } catch {
            // sem storage
          }
        }
        if (active && !sameOwner) {
          setPreferences((prev) => {
            const base = deviceOnly(prev);
            const next = data?.preferences ? mergeUserPreferences(base, data.preferences) : base;
            try {
              window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          });
        }
        if (active && sameOwner && data?.preferences) {
          if (data.preferences.themeStyling?.themeColor) {
            applyThemeColorFromServer(data.preferences.themeStyling.themeColor);
          }
          setPreferences((prev) => {
            const merged = mergeUserPreferences(prev, data.preferences);
            try {
              window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      } catch {
        // ignora se offline
      } finally {
        if (active) setRemoteLoaded(true);
      }
    }

    loadRemotePreferences();

    return () => {
      active = false;
    };
  }, [ownerId]);

  // A cor de destaque mudou (nesta tela): guarda nas preferencias da pessoa.
  useEffect(() => {
    const unsubscribe = subscribeToThemeColor((themeColor) => {
      if (isThemeSyncingFromServer()) return;

      const stylingPayload = { themeColor };

      setPreferences((prev) => {
        const next = {
          ...prev,
          themeStyling: stylingPayload,
        };
        try {
          window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      pendingRef.current = {
        ...pendingRef.current,
        themeStyling: stylingPayload,
      };
      scheduleSync();
    });

    return unsubscribe;
  }, [scheduleSync]);

  // Flush imediato ao fechar aba ou trocar de janela
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        if (Object.keys(pendingRef.current).length > 0) {
          const payload = JSON.stringify(pendingRef.current);
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/preferences", payload);
          } else {
            fetch("/api/preferences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              keepalive: true,
            }).catch(() => {});
          }
          pendingRef.current = {};
          isDirtyRef.current = false;
          setIsDirty(false);
        }
      }
    }

    function handleBeforeUnload() {
      if (isDirtyRef.current && Object.keys(pendingRef.current).length > 0) {
        const payload = JSON.stringify(pendingRef.current);
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/preferences", payload);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Escutar eventos contextuais disparados pelas telas (modo lista/cards e tamanho de página)
  useEffect(() => {
    function handleViewModeChange(e: Event) {
      const customEvent = e as CustomEvent<{ key?: string; mode?: "list" | "grid" }>;
      const { key, mode } = customEvent.detail ?? {};
      if (key && (mode === "list" || mode === "grid")) {
        setPreferences((prev) => {
          if (prev.viewModes[key] === mode) return prev;
          const next = {
            ...prev,
            viewModes: { ...prev.viewModes, [key]: mode },
          };
          try {
            window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        pendingRef.current = {
          ...pendingRef.current,
          viewModes: {
            ...(pendingRef.current.viewModes ?? {}),
            [key]: mode,
          },
        };
        scheduleSync();
      }
    }

    function handlePageSizeChange(e: Event) {
      const customEvent = e as CustomEvent<{ screenKey?: string; pageSize?: number }>;
      const { screenKey, pageSize } = customEvent.detail ?? {};
      if (pageSize && typeof pageSize === "number") {
        setPreferences((prev) => {
          const next = {
            ...prev,
            defaultPageSize: pageSize,
            pageSizes: screenKey
              ? { ...(prev.pageSizes ?? {}), [screenKey]: pageSize }
              : prev.pageSizes,
          };
          try {
            window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        pendingRef.current = {
          ...pendingRef.current,
          defaultPageSize: pageSize,
          ...(screenKey
            ? {
                pageSizes: {
                  ...(pendingRef.current.pageSizes ?? {}),
                  [screenKey]: pageSize,
                },
              }
            : {}),
        };
        scheduleSync();
      }
    }

    window.addEventListener("gestarahub:viewmode-change", handleViewModeChange);
    window.addEventListener("gestarahub:pagesize-change", handlePageSizeChange);

    return () => {
      window.removeEventListener("gestarahub:viewmode-change", handleViewModeChange);
      window.removeEventListener("gestarahub:pagesize-change", handlePageSizeChange);
    };
  }, [scheduleSync]);

  // Limpeza de atributo de densidade legado, mantendo o padrão confortável do sistema
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute("data-density");
    }
  }, []);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        updatePreferences,
        resetPreferences,
        isDirty,
        remoteLoaded,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    // Fallback gracioso caso chamado fora do provider (ex.: testes ou telas isoladas)
    return {
      preferences: DEFAULT_USER_PREFERENCES,
      updatePreference: () => {},
      updatePreferences: () => {},
      resetPreferences: async () => {},
      isDirty: false,
      // Fora do provider nao ha carga remota a esperar.
      remoteLoaded: true,
    };
  }
  return ctx;
}
