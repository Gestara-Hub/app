"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useIsFetching } from "@tanstack/react-query";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { SITE_NAME } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Abertura do app instalado so na primeira tela (25/11/2026). A pagina
 * `/launch` marca a abertura e pede o Painel; o painel cobre a tela com a
 * mesma logo ate as leituras da primeira tela terminarem. Depois disso, e nas
 * proximas telas, vale o carregamento normal (esqueletos).
 */
const LAUNCH_KEY = "gestarahub:launch-splash";
/** Marca velha (ex.: abriu, caiu no login e entrou minutos depois) nao vale. */
const LAUNCH_MAX_AGE_MS = 30_000;
/** Sem leitura em andamento por este tempo: a primeira tela esta pronta. */
const SETTLE_MS = 500;
/** Rede lenta: a tela aparece de qualquer jeito, com os esqueletos. */
const MAX_WAIT_MS = 10_000;

export function markLaunchSplash(): void {
  try {
    sessionStorage.setItem(LAUNCH_KEY, String(Date.now()));
  } catch {
    // Sem armazenamento: abre como as outras telas.
  }
}

function launchPending(): boolean {
  try {
    const at = Number(sessionStorage.getItem(LAUNCH_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < LAUNCH_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function clearLaunch(): void {
  try {
    sessionStorage.removeItem(LAUNCH_KEY);
  } catch {
    // nada
  }
}

const subscribeNever = () => () => {};

/** Logo no fundo do tema e a barrinha: a mesma na `/launch` e no painel. */
export function LaunchSplashContent({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <Image src={logoLightImage} alt={SITE_NAME} className="h-16 w-auto dark:hidden" priority />
      <Image src={logoDarkImage} alt={SITE_NAME} className="hidden h-16 w-auto dark:block" priority />
      <div className="flex h-10 flex-col items-center gap-3" role="status" aria-live="polite">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[launch-bar_1.2s_ease-in-out_infinite]" />
        </div>
        <span className="sr-only">Abrindo o GestaraHub</span>
        {children}
      </div>
    </>
  );
}

export function LaunchSplashOverlay() {
  // So no navegador: no servidor (e numa recarga comum) nao ha abertura.
  const pending = useSyncExternalStore(subscribeNever, launchPending, () => false);
  const [phase, setPhase] = useState<"open" | "leaving" | "done">("open");
  const fetching = useIsFetching();
  const active = pending && phase !== "done";

  useEffect(() => {
    if (!pending || phase !== "open") return;
    const finish = () => setPhase("leaving");
    const cap = setTimeout(finish, MAX_WAIT_MS);
    const settle = fetching === 0 ? setTimeout(finish, SETTLE_MS) : undefined;
    return () => {
      clearTimeout(cap);
      if (settle) clearTimeout(settle);
    };
  }, [pending, phase, fetching]);

  useEffect(() => {
    if (phase !== "leaving") return;
    clearLaunch();
    const timer = setTimeout(() => setPhase("done"), 200);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!active) return null;
  return (
    <div
      data-testid="launch-splash"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background px-6 transition-opacity duration-200",
        phase === "leaving" && "pointer-events-none opacity-0",
      )}
    >
      <LaunchSplashContent />
    </div>
  );
}
