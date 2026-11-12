"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
/** Troca rapida nao mostra nada (mesma espera da barra da lista ao atualizar). */
const SHOW_AFTER_MS = 250;

/**
 * Barra fina no topo enquanto a proxima tela chega (doc 07 §1.9). Substitui o
 * `app/(app)/loading.tsx` (11/11/2026): a fronteira de streaming dele fazia a
 * pagina hidratar depois do layout, e os dados que o layout ja tinha buscado
 * mudavam a primeira renderizacao (React #418), alem de quebrar o `redirect()`
 * das guardas (React #310). Aqui a barra liga no clique de um link interno e
 * some quando o endereco muda; nada de Suspense em volta da pagina.
 *
 * Vai para o body por portal: o template de (app) anima a entrada com
 * `transform`, e ancestral com transform prende o `fixed` nele.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = `${pathname}?${search}`;
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  // Endereco em que a barra ligou: trocou o endereco, ela some sozinha.
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    let timer: number | undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      const from = routeRef.current;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // So liga se ainda estamos na tela do clique (a troca nao veio antes).
        if (routeRef.current === from) setStartedOn(from);
      }, SHOW_AFTER_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!isClient || startedOn === null || startedOn !== route) return null;
  return createPortal(
    <div role="status" aria-label="Carregando" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div className="list-refresh-bar h-full w-1/4 rounded-full bg-primary" />
    </div>,
    document.body,
  );
}
