"use client";

import type { CaptureResult, PostHog } from "posthog-js";
import { readAnalyticsConsent, writeAnalyticsConsent } from "@/lib/analytics-consent";
import { URL_PROPERTIES, scrubAnalyticsUrl } from "@/lib/analytics-url";

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
// PostHog sob demanda (11/11/2026): ~115 KB gzip que iam em toda pagina, inclusive
// nos links publicos de pagamento, mesmo sem chave e antes do aceite. So baixa
// depois do aceite; o que chega antes de ele carregar espera na fila.
let posthog: PostHog | null = null;
const pending: ((ph: PostHog) => void)[] = [];

function withPosthog(run: (ph: PostHog) => void): void {
  if (posthog) run(posthog);
  else if (started) pending.push(run);
}

export function initAnalytics(): void {
  if (started || !KEY || typeof window === "undefined") return;
  if (readAnalyticsConsent() !== "granted") return;
  started = true;
  void import("posthog-js").then(({ default: ph }) => {
    posthog = ph;
    startPosthog(ph, KEY);
    for (const run of pending.splice(0)) run(ph);
  });
}

function startPosthog(posthog: PostHog, key: string): void {
  posthog.init(key, {
    api_host: HOST,
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    enable_heatmaps: true,
    // Velocidade de carregamento das telas (Web Vitals), por endereco ja limpo (doc technical/27).
    capture_performance: { web_vitals: true },
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: `[${ANALYTICS_MASK_ATTRIBUTE}]`,
      // A gravacao tambem leva o endereco: o mesmo limpador dos eventos.
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: scrubAnalyticsUrl(request.name) }),
    },
    // Endereco sem tokens, e-mail nem o id dos links publicos (auditoria de 30/10/2026).
    before_send: scrubEvent,
  });
  // Recusou numa visita anterior e aceitou agora: o PostHog guarda a recusa.
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
  if (currentIdentity) identify(posthog, currentIdentity);
}

function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event;
  for (const key of URL_PROPERTIES) {
    const value = event.properties[key];
    if (typeof value === "string") event.properties[key] = scrubAnalyticsUrl(value);
  }
  for (const bag of [event.$set, event.$set_once]) {
    if (!bag) continue;
    for (const key of URL_PROPERTIES) {
      const value = (bag as Record<string, unknown>)[key];
      if (typeof value === "string") (bag as Record<string, unknown>)[key] = scrubAnalyticsUrl(value);
    }
  }
  return event;
}

function identify(posthog: PostHog, user: AnalyticsIdentity): void {
  // Outra pessoa no mesmo navegador (troca de usuario): comeca uma identidade nova.
  if (posthog.get_distinct_id() !== user.id && posthog.get_property("$user_state") === "identified") {
    posthog.reset();
  }
  posthog.identify(user.id, { profile: user.profile, organizationId: user.organizationId });
}

export function identifyUser(user: AnalyticsIdentity): void {
  currentIdentity = user;
  if (started) withPosthog((ph) => identify(ph, user));
  // Efeito do filho roda antes do efeito do Providers: inicia aqui se preciso
  // (e o init identifica o `currentIdentity`).
  else initAnalytics();
}

/**
 * Evento de produto (ex.: clique no cadastro da landing). Sem chave ou sem o
 * aceite dos cookies, nao faz nada. Nunca mandar nome, e-mail ou texto digitado.
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  withPosthog((ph) => ph.capture(name, properties));
}

/** Ao sair: as proximas visitas neste navegador ficam anonimas. */
export function resetAnalytics(): void {
  currentIdentity = null;
  withPosthog((ph) => ph.reset());
}

/** Resposta do aviso de cookies: aceitar liga o PostHog; recusar para a captura. */
export function setAnalyticsConsent(value: "granted" | "denied"): void {
  writeAnalyticsConsent(value);
  if (value === "granted") {
    if (started) withPosthog((ph) => ph.opt_in_capturing());
    else initAnalytics();
  } else {
    withPosthog((ph) => ph.opt_out_capturing());
  }
}

/** "Rever minha escolha": apaga a resposta e o aviso volta a aparecer. */
export function reviewAnalyticsConsent(): void {
  writeAnalyticsConsent("unset");
}
