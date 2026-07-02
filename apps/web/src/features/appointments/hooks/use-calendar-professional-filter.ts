"use client";

import { useCallback, useSyncExternalStore } from "react";

// Filtro de profissionais da Agenda (calendario). Persistido no navegador,
// separado do mock (`gestarahub:db`) e do tema (`gestarahub:theme`).
const STORAGE_KEY = "gestarahub:calendar-professionals";

/**
 * `null` = "Todos" (sem filtro — inclui profissionais adicionados depois e
 * eventuais agendamentos de inativos que hoje aparecem em Semana/Mes).
 * `string[]` = subconjunto explicito de ids de profissional (pode ser vazio).
 */
type Filter = string[] | null;

// Cache para o getSnapshot devolver referencia ESTAVEL (requisito do
// useSyncExternalStore): so re-parseia quando a string do localStorage muda.
let cachedRaw: string | null = null;
let cachedValue: Filter = null;
const listeners = new Set<() => void>();

function read(): Filter {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (raw === null) {
    cachedValue = null;
    return cachedValue;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedValue =
      parsed === null ||
      (Array.isArray(parsed) && parsed.every((x) => typeof x === "string"))
        ? (parsed as Filter)
        : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

function write(value: Filter): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignora falha de escrita (modo privado, quota, etc.).
  }
  // Espelha no cache para o proximo snapshot bater com o que acabou de gravar.
  cachedRaw = JSON.stringify(value);
  cachedValue = value;
  listeners.forEach((notify) => notify());
}

export function useCalendarProfessionalFilter() {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    // Sincroniza entre abas.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useSyncExternalStore(subscribe, read, () => null);
  const setValue = useCallback((next: Filter) => write(next), []);
  return [value, setValue] as const;
}
