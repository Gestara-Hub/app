"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TourStep {
  /** Seletor CSS do alvo destacado (ex.: '[data-tour="nav-agenda"]'). */
  target: string;
  title: string;
  body: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 320;
const GAP = 12;
const HIGHLIGHT_PADDING = 8;

/**
 * Tour por spotlight, custom (sem dependencia): escurece a tela, recorta o alvo
 * do passo atual (via box-shadow) e posiciona um balao ao lado. Recalcula o
 * retangulo em resize/scroll. Se o alvo nao existir, cai para um balao central.
 *
 * Montado apenas enquanto ativo (o pai renderiza condicionalmente), entao o
 * indice ja nasce em 0 sem precisar resetar via efeito.
 */
export function ProductTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Traz o alvo para a area visivel uma vez por passo (fora do measure, para o
  // scroll continuo nao brigar com o reposicionamento).
  useEffect(() => {
    if (!step) return;
    document
      .querySelector(step.target)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [step]);

  // Mede via rAF/listeners (nunca sincrono no corpo do efeito) para reposicionar
  // o recorte a cada passo, resize ou scroll.
  useLayoutEffect(() => {
    if (!step) return;
    let raf = requestAnimationFrame(measure);
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step, measure]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step || typeof document === "undefined") return null;

  const isLast = index === steps.length - 1;

  const highlight = rect
    ? {
        top: rect.top - HIGHLIGHT_PADDING,
        left: rect.left - HIGHLIGHT_PADDING,
        width: rect.width + HIGHLIGHT_PADDING * 2,
        height: rect.height + HIGHLIGHT_PADDING * 2,
      }
    : null;

  let tooltipStyle: CSSProperties;
  if (!rect) {
    tooltipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const spaceRight = window.innerWidth - (rect.left + rect.width);
    let top: number;
    let left: number;
    if (spaceRight > TOOLTIP_WIDTH + GAP + 8) {
      left = rect.left + rect.width + GAP;
      top = rect.top;
    } else {
      left = rect.left;
      top = rect.top + rect.height + GAP;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - 200));
    tooltipStyle = { top, left };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Captura cliques para bloquear a UI por baixo; dim quando nao ha recorte. */}
      <div className={rect ? "absolute inset-0" : "absolute inset-0 bg-black/60"} />

      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-label={step.title}
        className="absolute w-[min(20rem,calc(100vw-2rem))] rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
        style={tooltipStyle}
      >
        {steps.length > 1 ? (
          <p className="text-xs font-medium text-muted-foreground">
            Passo {index + 1} de {steps.length}
          </p>
        ) : null}
        <h3 className="mt-0.5 text-sm font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div
          className={cn(
            "mt-4 flex items-center gap-2",
            steps.length > 1 ? "justify-between" : "justify-end",
          )}
        >
          {steps.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Pular
            </Button>
          ) : null}
          <div className="flex gap-2">
            {index > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Voltar
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
            >
              {isLast ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
