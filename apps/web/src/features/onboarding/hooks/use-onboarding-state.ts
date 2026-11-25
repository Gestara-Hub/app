"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useCurrentUser } from "@/features/auth";
import { hasSeenMark, setSeenMark, useSeenMark, useSeenMarksReady } from "@/lib/seen-marks";

/**
 * Estado do onboarding por pessoa e por espaco. Desde 25/11/2026 fica na conta
 * (`lib/seen-marks`): as boas-vindas nao voltam em outro navegador, no celular
 * ou no app instalado. Antes era um JSON no navegador por espaco
 * (`gestarahub:onboarding:<espaco>`), que sobe para a conta na primeira visita.
 */
const LEGACY_PREFIX = "gestarahub:onboarding";

export interface OnboardingState {
  /** Modal de boas-vindas ja respondido: nao reabrir sozinho. */
  seen: boolean;
  /** Usuario ocultou o checklist de Primeiros passos. */
  dismissed: boolean;
  /** A conta ja respondeu: so entao decidir abrir as boas-vindas (senao ela pisca). */
  ready: boolean;
}

function keys(orgId: string) {
  const base = `${LEGACY_PREFIX}:${orgId || "sem-espaco"}`;
  return { legacy: base, seen: `${base}:welcome-seen`, dismissed: `${base}:dismissed` };
}

/** JSON antigo do navegador (vale na leitura ate subir para a conta, sem piscar). */
function readLegacy(key: string): { seen: boolean; dismissed: boolean } {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as { seen?: boolean; dismissed?: boolean }) : {};
    return { seen: Boolean(parsed.seen), dismissed: Boolean(parsed.dismissed) };
  } catch {
    return { seen: false, dismissed: false };
  }
}

/** Marcas do JSON antigo do navegador que ainda nao estao na conta: sobem uma vez. */
function migrateLegacy(k: ReturnType<typeof keys>) {
  try {
    const raw = window.localStorage.getItem(k.legacy);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { seen?: boolean; dismissed?: boolean };
    if (parsed.seen && !hasSeenMark(k.seen)) setSeenMark(k.seen);
    if (parsed.dismissed && !hasSeenMark(k.dismissed)) setSeenMark(k.dismissed);
    window.localStorage.removeItem(k.legacy);
  } catch {
    // JSON velho invalido ou sem storage: nada a subir.
  }
}

export function useOnboardingState() {
  let orgId = "";
  try {
    const user = useCurrentUser();
    orgId = user.organizationId;
  } catch {
    // fora de SessionProvider
  }
  const k = useMemo(() => keys(orgId), [orgId]);
  const ready = useSeenMarksReady();
  const seen = useSeenMark(k.seen);
  const dismissed = useSeenMark(k.dismissed);

  useEffect(() => {
    if (ready) migrateLegacy(k);
  }, [ready, k]);

  const legacy = useMemo(() => (typeof window === "undefined" ? { seen: false, dismissed: false } : readLegacy(k.legacy)), [k]);
  const state: OnboardingState = { seen: seen || legacy.seen, dismissed: dismissed || legacy.dismissed, ready };
  const update = useCallback(
    (patch: Partial<Pick<OnboardingState, "seen" | "dismissed">>) => {
      if (patch.seen !== undefined) setSeenMark(k.seen, patch.seen);
      if (patch.dismissed !== undefined) setSeenMark(k.dismissed, patch.dismissed);
    },
    [k],
  );
  return [state, update] as const;
}
