"use client";

import posthog from "posthog-js";
import { readAnalyticsConsent, writeAnalyticsConsent } from "@/lib/analytics-consent";

/**
 * Analise de uso com o PostHog (docs/technical/09): paginas, cliques
 * (autocapture), mapa de calor e gravacao de sessao. So liga com a chave no
 * ambiente E depois que a pessoa aceita os cookies de analise (aviso em
 * `components/shared/analytics-consent-banner`). Sem chave, nada liga (dev,
 * testes e e2e seguem sem enviar dados nem mostrar o aviso).
 *
 * Privacidade: o que se digita nunca e gravado (`maskAllInputs`) e, dentro da
 * area logada, todo texto fica oculto nas gravacoes (`data-analytics-mask` no
 * casco do app): dados de alunos nao saem do sistema. A pessoa e identificada
 * so pelo id, perfil e organizacao (sem nome nem e-mail).
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** Ha chave do PostHog no ambiente (sem ela, nem o aviso de cookies aparece). */
export const isAnalyticsConfigured = Boolean(KEY);

/** Atributo que oculta todo texto do elemento (e dos filhos) nas gravacoes. */
export const ANALYTICS_MASK_ATTRIBUTE = "data-analytics-mask";

interface AnalyticsIdentity {
  id: string;
  profile: string;
  organizationId: string;
}

let started = false;
// Usuario logado: identificado assim que o PostHog ligar (o aceite pode vir depois).
let currentIdentity: AnalyticsIdentity | null = null;

export function initAnalytics(): void {
  if (started || !KEY || typeof window === "undefined") return;
  if (readAnalyticsConsent() !== "granted") return;
  started = true;
  posthog.init(KEY, {
    api_host: HOST,
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    enable_heatmaps: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: `[${ANALYTICS_MASK_ATTRIBUTE}]`,
    },
  });
  // Recusou numa visita anterior e aceitou agora: o PostHog guarda a recusa.
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
  if (currentIdentity) identify(currentIdentity);
}

function identify(user: AnalyticsIdentity): void {
  // Outra pessoa no mesmo navegador (troca de usuario): comeca uma identidade nova.
  if (posthog.get_distinct_id() !== user.id && posthog.get_property("$user_state") === "identified") {
    posthog.reset();
  }
  posthog.identify(user.id, { profile: user.profile, organizationId: user.organizationId });
}

export function identifyUser(user: AnalyticsIdentity): void {
  currentIdentity = user;
  if (started) identify(user);
  // Efeito do filho roda antes do efeito do Providers: inicia aqui se preciso
  // (e o init identifica o `currentIdentity`).
  else initAnalytics();
}

/** Ao sair: as proximas visitas neste navegador ficam anonimas. */
export function resetAnalytics(): void {
  currentIdentity = null;
  if (started) posthog.reset();
}

/** Resposta do aviso de cookies: aceitar liga o PostHog; recusar para a captura. */
export function setAnalyticsConsent(value: "granted" | "denied"): void {
  writeAnalyticsConsent(value);
  if (value === "granted") {
    if (started) posthog.opt_in_capturing();
    else initAnalytics();
  } else if (started) {
    posthog.opt_out_capturing();
  }
}

/** "Rever minha escolha": apaga a resposta e o aviso volta a aparecer. */
export function reviewAnalyticsConsent(): void {
  writeAnalyticsConsent("unset");
}
