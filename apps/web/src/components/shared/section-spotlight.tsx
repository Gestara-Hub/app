"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Folga do recorte em volta da secao: cabe o anel de atencao (10px) dos botoes destacados.
const PADDING = 12;

/**
 * Destaque de uma secao da tela (chegada pelo onboarding): escurece o resto da
 * tela e deixa a secao clara. O escuro e so visual (nao segura clique): a
 * secao e o resto da tela continuam clicaveis, e um clique fora da secao fecha
 * o destaque e segue para onde foi (ex.: "Salvar" logo abaixo salva de
 * primeira). Fecha tambem com Esc ou quando `active` fica falso (o passo foi
 * concluido). Menus e modais abertos a partir da secao nao fecham o destaque.
 */
export function SectionSpotlight({
  active,
  targetRefs,
  onDismiss,
  hint,
}: {
  active: boolean;
  /**
   * Partes destacadas (ex.: a secao e o rodape com o botao de salvar): o
   * recorte cobre a area que junta todas.
   */
  targetRefs: RefObject<HTMLElement | null>[];
  onDismiss: () => void;
  /** Frase curta acima da secao, dizendo o que fazer. */
  hint?: string;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const rects = targetRefs
      .map((ref) => ref.current?.getBoundingClientRect())
      .filter((r): r is DOMRect => Boolean(r && (r.width > 0 || r.height > 0)));
    if (rects.length === 0) {
      setRect((prev) => (prev === null ? prev : null));
      return;
    }
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const right = Math.max(...rects.map((r) => r.right));
    const next = { top, left, width: right - left, height: bottom - top };
    // So atualiza quando mudou (o laco abaixo mede a cada quadro).
    setRect((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next,
    );
  }, [targetRefs]);

  // Traz a secao para a tela uma vez, ao ligar.
  useEffect(() => {
    if (!active) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targetRefs[0]?.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    // So na ligada: as partes nao mudam enquanto o destaque esta aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Mede a cada quadro enquanto aberto: acompanha a secao crescendo (dia
  // ligado, turno novo, acordeao abrindo), rolagem e redimensionamento, sem
  // depender de avisos do navegador.
  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      measure();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (targetRefs.some((ref) => ref.current?.contains(target))) return;
      // Menus, seletores e modais abertos pela secao (portais do Radix).
      if (
        target.closest(
          '[data-radix-popper-content-wrapper], [data-slot="dialog-content"], [data-slot="alert-dialog-content"], [role="listbox"], [role="menu"]',
        )
      ) {
        return;
      }
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [active, onDismiss, targetRefs]);

  if (!active || !rect || typeof document === "undefined") return null;

  const top = rect.top - PADDING;
  const left = rect.left - PADDING;
  const width = rect.width + PADDING * 2;
  const height = rect.height + PADDING * 2;
  return createPortal(
    <div data-section-spotlight>
      {/* Um recorte arredondado com sombra larga em volta: o escuro segue a
          curva da borda (faixas retas deixavam os cantos claros). So visual. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] motion-safe:animate-in motion-safe:fade-in-0 dark:shadow-[0_0_0_9999px_rgb(0_0_0/0.65)]"
        style={{ top, left, width, height }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary/70"
        style={{ top, left, width, height }}
      />
      {hint ? (
        <p
          role="status"
          className="pointer-events-none fixed z-40 rounded-full bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-lg"
          style={{ top: Math.max(8, top - 44), left }}
        >
          {hint}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
