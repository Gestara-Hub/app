"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` durante o SSR e o 1o render de hidratacao; `true` apos hidratar.
 * Substitui o padrao `useState(false)+useEffect(setMounted)` sem setState em
 * efeito — util para so montar UI client-only (ex.: tours em portal) sem
 * divergencia de hidratacao.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
