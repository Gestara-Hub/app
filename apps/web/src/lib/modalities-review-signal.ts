"use client";

import { useSyncExternalStore } from "react";

/**
 * O aviso de configuracao inicial do topo esta mostrando o "Esta tudo certo"
 * da revisao das modalidades? O aviso amarelo da tela de Modalidades so mostra
 * o proprio botao quando o de cima nao mostra (nunca dois, nunca nenhum).
 */
let onBanner = false;
const listeners = new Set<() => void>();

export function setModalitiesReviewOnBanner(value: boolean): void {
  if (onBanner === value) return;
  onBanner = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useModalitiesReviewOnBanner(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => onBanner,
    () => false,
  );
}
