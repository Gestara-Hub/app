"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Avisa o pai quando o estado "sujo" do formulario muda. */
export function useReportDirty(dirty: boolean, onDirtyChange?: (dirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // Ao desmontar, o formulario deixa de contar como sujo
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}

/** Pede confirmacao do navegador ao recarregar/fechar a aba com alteracoes nao salvas. */
export function useBeforeUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Navegadores antigos exigem returnValue preenchido
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

/**
 * Sair da tela por um link (menu lateral, topo) com alteracoes nao salvas pede
 * confirmacao antes; confirmando, segue para o link. Abrir em outra aba passa.
 */
export function useLeaveLinkGuard(active: boolean, ask: () => Promise<boolean>) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      void ask().then((ok) => {
        if (ok) router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, ask, router]);
}
