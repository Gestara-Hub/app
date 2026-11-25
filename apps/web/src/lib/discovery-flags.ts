"use client";

import { hasSeenMark, setSeenMark, useSeenMark } from "./seen-marks";

/**
 * Marcas do card "Descubra o dia a dia", por organizacao e usuario: "Fechar"
 * (some para sempre), o "Proximo passo" do topo escondido e telas ja abertas
 * (Cobranças de curso, Financeiro), que nao deixam rastro no dado. Desde
 * 25/11/2026 ficam na conta da pessoa (`lib/seen-marks`), com copia no
 * navegador: valem em qualquer aparelho.
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

export function readStorageFlag(key: string): boolean {
  return hasSeenMark(key);
}

export function setStorageFlag(key: string): void {
  setSeenMark(key);
}

/** Marca a tela como aberta (chamado pela propria tela ao montar). */
export function markDiscoveryVisit(scope: DiscoveryScope, visit: DiscoveryVisit): void {
  setStorageFlag(discoveryVisitedKey(scope, visit));
}

/** Le a marca reagindo a escrita (nesta aba, em outras e na conta). No server: falso. */
export function useStorageFlag(key: string): boolean {
  return useSeenMark(key);
}
