"use client";

import { useMemo, type MouseEvent } from "react";
import { useAppRouter } from "./use-app-router";

/**
 * Linha ou cartao de lista que abre outra tela (27/11/2026, doc 07 §1.9). Nao
 * vira `<a>` porque leva o menu ⋮ dentro (botao dentro de link e invalido), mas
 * se comporta como link: busca a tela antes ao passar o mouse ou tocar
 * (o clique chega mais rapido), navega com a barra do topo e abre em nova aba
 * com Ctrl/Cmd+clique ou o botao do meio.
 */
export interface RowLinkHandlers {
  onClick: (event: MouseEvent) => void;
  onAuxClick: (event: MouseEvent) => void;
  onMouseEnter: () => void;
  onTouchStart: () => void;
  onFocus: () => void;
  /** Abrir pelo teclado (Enter/Espaco). */
  open: () => void;
}

export function useRowLink(href: string | undefined): RowLinkHandlers | null {
  const router = useAppRouter();
  return useMemo(() => {
    if (!href) return null;
    const newTab = () => window.open(href, "_blank", "noopener");
    let prefetched = false;
    const prefetch = () => {
      if (prefetched) return;
      prefetched = true;
      router.prefetch(href);
    };
    return {
      onClick: (event: MouseEvent) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          newTab();
          return;
        }
        router.push(href);
      },
      onAuxClick: (event: MouseEvent) => {
        if (event.button === 1) newTab();
      },
      onMouseEnter: prefetch,
      onTouchStart: prefetch,
      onFocus: prefetch,
      open: () => router.push(href),
    };
  }, [href, router]);
}

/** Props para um cartao (div) clicavel que abre outra tela. */
export function rowLinkProps(link: RowLinkHandlers | null) {
  if (!link) return {};
  return {
    onClick: link.onClick,
    onAuxClick: link.onAuxClick,
    onMouseEnter: link.onMouseEnter,
    onTouchStart: link.onTouchStart,
    onFocus: link.onFocus,
  };
}
