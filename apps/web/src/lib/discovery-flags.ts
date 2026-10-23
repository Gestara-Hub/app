"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Marcas do card "Descubra o dia a dia" guardadas no navegador, por
 * organizacao e usuario: "Fechar" (some para sempre), o "Proximo passo" do
 * topo escondido e telas ja abertas
 * (Cobranças de curso, Financeiro), que nao deixam rastro no dado.
 * Toda leitura e escrita tolera localStorage indisponivel (modo privado,
 * quota): sem storage, nada fica marcado e a tela funciona igual.
 */

/** Telas cuja simples abertura conclui um item do card. */
export type DiscoveryVisit = "course_billing" | "finance";

const DISMISSED_PREFIX = "gestarahub_discovery_dismissed";
const VISITED_PREFIX = "gestarahub_discovery_visited";
const BAR_HIDDEN_PREFIX = "gestarahub_discovery_bar_hidden";

export interface DiscoveryScope {
  organizationId: string;
  /** Id do usuario logado. */
  id: string;
}

export function discoveryDismissedKey(scope: DiscoveryScope): string {
  return `${DISMISSED_PREFIX}:${scope.organizationId}:${scope.id}`;
}

/** "Proximo passo" do topo escondido (o card do Painel continua). */
export function discoveryBarHiddenKey(scope: DiscoveryScope): string {
  return `${BAR_HIDDEN_PREFIX}:${scope.organizationId}:${scope.id}`;
}

export function discoveryVisitedKey(scope: DiscoveryScope, visit: DiscoveryVisit): string {
  return `${VISITED_PREFIX}:${scope.organizationId}:${scope.id}:${visit}`;
}

const listeners = new Set<() => void>();

export function readStorageFlag(key: string): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setStorageFlag(key: string): void {
  if (readStorageFlag(key)) return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Sem storage: a marca so nao persiste.
  }
  listeners.forEach((notify) => notify());
}

/** Marca a tela como aberta (chamado pela propria tela ao montar). */
export function markDiscoveryVisit(scope: DiscoveryScope, visit: DiscoveryVisit): void {
  setStorageFlag(discoveryVisitedKey(scope, visit));
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = () => onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Le a marca reagindo a escrita (nesta aba e em outras). No server: falso. */
export function useStorageFlag(key: string): boolean {
  const getSnapshot = useCallback(() => readStorageFlag(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
