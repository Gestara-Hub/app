"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "./unsaved-changes";

/**
 * Roteador do app (27/11/2026, doc 07 §1.9): igual ao do Next, mas liga a barra
 * fina do topo quando `push`/`replace` vai para OUTRA tela. Antes, linha de
 * lista e item de menu que navegavam por codigo deixavam a tela parada, sem
 * sinal, ate a proxima chegar. Trocar so a query (filtro, aba) na mesma tela
 * nao liga a barra. O lint barra o `useRouter` do Next fora daqui.
 */
type AppRouter = ReturnType<typeof useRouter>;

function leavesCurrentScreen(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(href, window.location.href).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

export function useAppRouter(): AppRouter {
  const router = useRouter();
  return useMemo<AppRouter>(
    () => ({
      ...router,
      push: (href, options) => {
        if (leavesCurrentScreen(href)) startNavigationProgress();
        router.push(href, options);
      },
      replace: (href, options) => {
        if (leavesCurrentScreen(href)) startNavigationProgress();
        router.replace(href, options);
      },
    }),
    [router],
  );
}
