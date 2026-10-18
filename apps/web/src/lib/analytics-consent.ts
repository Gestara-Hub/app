"use client";

import { useSyncExternalStore } from "react";

/**
 * Escolha da pessoa sobre os cookies de analise de uso (LGPD), guardada no
 * navegador. Sem escolha ("unset"), o aviso aparece e o PostHog nao liga.
 * Toda leitura e escrita tolera localStorage indisponivel (modo privado,
 * quota): sem storage, a escolha so nao persiste.
 */
export type AnalyticsConsent = "granted" | "denied" | "unset";

export const ANALYTICS_CONSENT_KEY = "gestarahub:analytics-consent";

const listeners = new Set<() => void>();

export function readAnalyticsConsent(): AnalyticsConsent {
  try {
    if (typeof window === "undefined") return "unset";
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    return "unset";
  }
}

/** Grava a escolha; "unset" apaga (o aviso volta a aparecer). */
export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  try {
    if (value === "unset") window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    else window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // Sem storage: a escolha vale so ate recarregar.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Le a escolha reagindo a mudancas (nesta aba e em outras). No server e na
 * hidratacao: "pending" (nada renderiza; evita o aviso piscar para quem ja
 * escolheu).
 */
export function useAnalyticsConsent(): AnalyticsConsent | "pending" {
  return useSyncExternalStore(subscribe, readAnalyticsConsent, () => "pending");
}
