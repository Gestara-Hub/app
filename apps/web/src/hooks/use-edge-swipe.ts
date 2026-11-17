"use client";

import { useEffect, useRef } from "react";

/**
 * Arrastar da borda esquerda abre o menu lateral no celular (17/11/2026). No
 * iPhone, o mesmo gesto e o "voltar" do sistema e levava para a tela anterior.
 * O toque que comeca colado na borda tem o padrao cancelado no `touchstart`
 * (o unico momento em que o Safari deixa impedir o voltar); botoes e campos
 * ficam de fora, para o toque neles seguir normal. Com o menu aberto,
 * arrastar para a esquerda fecha.
 */

/** Largura da faixa da borda que comeca o gesto, em px. */
export const EDGE_SWIPE_ZONE = 20;
/** Distancia horizontal que confirma o gesto, em px. */
export const EDGE_SWIPE_DISTANCE = 48;

export type EdgeSwipeResult = "open" | "close" | "none";

/**
 * O que um arrasto faz: abrir com o menu fechado (comecou na borda e foi para
 * a direita, mais na horizontal que na vertical); fechar com o menu aberto
 * (foi para a esquerda). Sem distancia suficiente, nada.
 */
export function edgeSwipeResult(
  start: { x: number; y: number },
  current: { x: number; y: number },
  menuOpen: boolean,
): EdgeSwipeResult {
  const dx = current.x - start.x;
  const dy = Math.abs(current.y - start.y);
  if (dy > Math.abs(dx)) return "none";
  if (!menuOpen && start.x <= EDGE_SWIPE_ZONE && dx >= EDGE_SWIPE_DISTANCE) return "open";
  if (menuOpen && dx <= -EDGE_SWIPE_DISTANCE) return "close";
  return "none";
}

const INTERACTIVE = "button, a, input, textarea, select, label, [role='button'], [contenteditable='true']";

/** Outra janela ou gaveta aberta (que nao seja o proprio menu): o gesto nao abre o menu por cima. */
function otherDialogOpen(): boolean {
  return Boolean(document.querySelector("[role='dialog'][data-state='open']:not([data-sidebar='sidebar'])"));
}

export function useEdgeSwipe(options: { enabled: boolean; menuOpen: boolean; setMenuOpen: (open: boolean) => void }) {
  const { enabled, menuOpen, setMenuOpen } = options;
  // Valores atuais sem recriar os ouvintes a cada render.
  const state = useRef({ menuOpen, setMenuOpen });
  useEffect(() => {
    state.current = { menuOpen, setMenuOpen };
  }, [menuOpen, setMenuOpen]);

  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;

    const onStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const { menuOpen: open } = state.current;
      if (open) {
        start = { x: touch.clientX, y: touch.clientY };
        return;
      }
      if (touch.clientX > EDGE_SWIPE_ZONE || otherDialogOpen()) return;
      start = { x: touch.clientX, y: touch.clientY };
      const target = event.target instanceof Element ? event.target : null;
      // Colado na borda e fora de botao ou campo: segura o "voltar" do sistema.
      if (!target?.closest(INTERACTIVE) && event.cancelable) event.preventDefault();
    };

    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const result = edgeSwipeResult(start, { x: touch.clientX, y: touch.clientY }, state.current.menuOpen);
      if (result === "none") return;
      start = null;
      state.current.setMenuOpen(result === "open");
    };

    const onEnd = () => {
      start = null;
    };

    document.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);
}
