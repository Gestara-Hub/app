"use client";

import { useCallback, useSyncExternalStore } from "react";

// Estado do onboarding, persistido no navegador (separado do mock e do tema).
// Mesma abordagem de `use-calendar-professional-filter` (useSyncExternalStore +
// cache de referencia estavel + sync entre abas).
const STORAGE_KEY = "gestarahub:onboarding";

export interface OnboardingState {
  /** Modal de boas-vindas ja respondido: nao reabrir sozinho. */
  seen: boolean;
  /** Usuario ocultou o checklist de Primeiros passos. */
  dismissed: boolean;
  /** Tours por tela ja vistos (id -> true), para nao reabrir no proximo acesso. */
  tours: Record<string, boolean>;
}

const DEFAULT_STATE: OnboardingState = {
  seen: false,
  dismissed: false,
  tours: {},
};

let cachedRaw: string | null = null;
let cachedValue: OnboardingState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function read(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_STATE;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (raw === null) {
    cachedValue = DEFAULT_STATE;
    return cachedValue;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    cachedValue = {
      seen: Boolean(parsed.seen),
      dismissed: Boolean(parsed.dismissed),
      tours:
        parsed.tours && typeof parsed.tours === "object"
          ? (parsed.tours as Record<string, boolean>)
          : {},
    };
  } catch {
    cachedValue = DEFAULT_STATE;
  }
  return cachedValue;
}

function write(next: OnboardingState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignora falha de escrita (modo privado, quota, etc.).
  }
  cachedRaw = JSON.stringify(next);
  cachedValue = next;
  listeners.forEach((notify) => notify());
}

export function useOnboardingState() {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const state = useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
  const update = useCallback(
    (patch: Partial<OnboardingState>) => write({ ...read(), ...patch }),
    [],
  );
  return [state, update] as const;
}
