"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/features/auth";

// Estado do onboarding, persistido no navegador por organização (isolado por tenant).
const STORAGE_PREFIX = "gestarahub:onboarding";

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

const cache = new Map<string, { raw: string | null; value: OnboardingState }>();
const listeners = new Set<() => void>();

function read(key: string): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return DEFAULT_STATE;
  }
  const entry = cache.get(key);
  if (entry && entry.raw === raw) return entry.value;

  if (raw === null) {
    const next = DEFAULT_STATE;
    cache.set(key, { raw: null, value: next });
    return next;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    const next: OnboardingState = {
      seen: Boolean(parsed.seen),
      dismissed: Boolean(parsed.dismissed),
      tours:
        parsed.tours && typeof parsed.tours === "object"
          ? (parsed.tours as Record<string, boolean>)
          : {},
    };
    cache.set(key, { raw, value: next });
    return next;
  } catch {
    cache.set(key, { raw, value: DEFAULT_STATE });
    return DEFAULT_STATE;
  }
}

function write(key: string, next: OnboardingState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignora falha de escrita (modo privado, quota, etc.).
  }
  cache.set(key, { raw: JSON.stringify(next), value: next });
  listeners.forEach((notify) => notify());
}

export function useOnboardingState() {
  let orgId = "";
  try {
    const user = useCurrentUser();
    orgId = user.organizationId;
  } catch {
    // fora de SessionProvider
  }
  const storageKey = orgId ? `${STORAGE_PREFIX}:${orgId}` : STORAGE_PREFIX;

  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [storageKey],
  );

  const state = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => DEFAULT_STATE,
  );
  const update = useCallback(
    (patch: Partial<OnboardingState>) =>
      write(storageKey, { ...read(storageKey), ...patch }),
    [storageKey],
  );
  return [state, update] as const;
}
