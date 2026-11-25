"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  NAVIGATION_CANCELLED_EVENT,
  NAVIGATION_STARTED_EVENT,
} from "@/lib/unsaved-changes";
import { useLaunchSplashVisible } from "./launch-splash";

const subscribe = () => () => {};
/** Troca rapida nao mostra nada (mesma espera da barra da lista ao atualizar). */
const SHOW_AFTER_MS = 250;
/** Limite de seguranca para a barra nunca ficar presa se a navegacao for cancelada ou falhar. */
const MAX_VISIBLE_MS = 15_000;

let activeDataLoads = 0;
const dataLoadListeners = new Set<() => void>();
function emitDataLoads() {
  dataLoadListeners.forEach((notify) => notify());
}
function subscribeDataLoads(onChange: () => void) {
  dataLoadListeners.add(onChange);
  return () => {
    dataLoadListeners.delete(onChange);
  };
}
function getDataLoadSnapshot() {
  return activeDataLoads > 0;
}

/**
 * Mantem a barra fina global ligada enquanto uma tela ou guarda espera os
 * dados iniciais no navegador (sem duplicar portais entre componentes).
 */
export function useRouteLoadingBar(active: boolean) {
  useEffect(() => {
    if (!active) return;
    activeDataLoads += 1;
    emitDataLoads();
    return () => {
      activeDataLoads = Math.max(0, activeDataLoads - 1);
      emitDataLoads();
    };
  }, [active]);
}

/**
 * Barra fina no topo enquanto a proxima tela chega (doc 07 §1.9). Substitui o
 * `app/(app)/loading.tsx` (11/11/2026): a fronteira de streaming dele fazia a
 * pagina hidratar depois do layout, e os dados que o layout ja tinha buscado
 * mudavam a primeira renderizacao (React #418), alem de quebrar o `redirect()`
 * das guardas (React #310). Aqui a barra liga no clique de um link interno e
 * zera assim que o endereco muda; nada de Suspense em volta da pagina.
 *
 * Vai para o body por portal: o template de (app) anima a entrada com
 * `transform`, e ancestral com transform prende o `fixed` nele.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = `${pathname}?${search}`;
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const routeLoading = useSyncExternalStore(subscribeDataLoads, getDataLoadSnapshot, () => false);
  // Abertura do app instalado na tela: so a barrinha dela, sem a do topo.
  const splashVisible = useLaunchSplashVisible();
  const [prevRoute, setPrevRoute] = useState(route);
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const routeRef = useRef(route);
  const showTimerRef = useRef<number | undefined>(undefined);
  const safetyTimerRef = useRef<number | undefined>(undefined);

  // Zera o estado assim que a rota muda: evita que a barra volte ligada ao retornar para a rota anterior.
  if (prevRoute !== route) {
    setPrevRoute(route);
    if (startedOn !== null) setStartedOn(null);
  }

  useEffect(() => {
    routeRef.current = route;
    window.clearTimeout(showTimerRef.current);
    window.clearTimeout(safetyTimerRef.current);
  }, [route]);

  useEffect(() => {
    const clearTimers = () => {
      window.clearTimeout(showTimerRef.current);
      window.clearTimeout(safetyTimerRef.current);
    };

    const showNow = (from: string) => {
      clearTimers();
      setStartedOn(from);
      safetyTimerRef.current = window.setTimeout(() => {
        setStartedOn(null);
      }, MAX_VISIBLE_MS);
    };

    const scheduleShow = (from: string) => {
      clearTimers();
      showTimerRef.current = window.setTimeout(() => {
        // So liga se ainda estamos na tela do clique (a troca nao veio antes).
        if (routeRef.current !== from) return;
        showNow(from);
      }, SHOW_AFTER_MS);
    };

    const cancel = () => {
      clearTimers();
      setStartedOn(null);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      scheduleShow(routeRef.current);
    };

    const onNavStart = (event: Event) => {
      const immediate = (event as CustomEvent<{ immediate?: boolean } | undefined>).detail?.immediate;
      if (immediate) showNow(routeRef.current);
      else scheduleShow(routeRef.current);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_STARTED_EVENT, onNavStart);
    window.addEventListener(NAVIGATION_CANCELLED_EVENT, cancel);
    return () => {
      clearTimers();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_STARTED_EVENT, onNavStart);
      window.removeEventListener(NAVIGATION_CANCELLED_EVENT, cancel);
    };
  }, []);

  const navVisible = startedOn !== null && startedOn === route;
  if (!isClient || splashVisible || (!navVisible && !routeLoading)) return null;
  return createPortal(
    <div role="status" aria-label="Carregando" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div className="dialog-saving-bar h-full w-1/4 rounded-full bg-primary" />
    </div>,
    document.body,
  );
}
