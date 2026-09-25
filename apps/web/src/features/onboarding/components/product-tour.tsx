"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

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

const MOBILE_TRIGGER_STEP: TourStep = {
  target: '[data-sidebar="trigger"]',
  title: "Menu de Navegação",
  body: "No celular, o menu lateral fica recolhido para ganhar espaço. Toque neste ícone no topo sempre que quiser abrir os módulos.",
};

function isSidebarTarget(target: string): boolean {
  return target.includes("nav-") || target.includes("sidebar-nav");
}

/**
 * Tour por spotlight, custom (sem dependencia): escurece a tela, recorta o alvo
 * do passo atual (via box-shadow) e posiciona um balao ao lado. Recalcula o
 * retangulo em resize/scroll. Se o alvo nao existir, cai para um balao central.
 *
 * No mobile (abordagem hibrida):
 * 1. Comeca destacando o botao SidebarTrigger no topo;
 * 2. Abre automaticamente a gaveta lateral nos passos de menu para destacar cada secao ao vivo;
 * 3. Fecha a gaveta automaticamente ao focar no checklist da pagina ou ao encerrar o tour.
 */
export function ProductTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(188);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const effectiveSteps = useMemo(() => {
    if (!isMobile) return steps;
    if (steps.length === 0) return steps;
    if (steps[0]?.target === '[data-tour="sidebar-nav"]') {
      return [MOBILE_TRIGGER_STEP, ...steps.slice(1)];
    }
    if (steps[0]?.target !== '[data-sidebar="trigger"]') {
      return [MOBILE_TRIGGER_STEP, ...steps];
    }
    return steps;
  }, [isMobile, steps]);

  const step = effectiveSteps[index];

  const handleClose = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onClose();
  }, [isMobile, setOpenMobile, onClose]);

  const measure = useCallback(() => {
    if (tooltipRef.current?.offsetHeight) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Abre/fecha a gaveta mobile automaticamente conforme o alvo do passo atual.
  useEffect(() => {
    if (!step || !isMobile) return;
    const needsSidebar = isSidebarTarget(step.target);
    setOpenMobile(needsSidebar);
  }, [step, isMobile, setOpenMobile]);

  // Traz o alvo para a area visivel uma vez por passo (fora do measure, para o
  // scroll continuo nao brigar com o reposicionamento).
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(
      () => {
        document
          .querySelector(step.target)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      },
      isMobile && isSidebarTarget(step.target) ? 200 : 0,
    );
    return () => clearTimeout(timer);
  }, [step, isMobile]);

  // Mede via rAF/listeners/timeouts para acompanhar tambem a animacao de abertura
  // do Sheet mobile (slide-in).
  useLayoutEffect(() => {
    if (!step) return;
    let raf = requestAnimationFrame(measure);
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const t1 = setTimeout(schedule, 60);
    const t2 = setTimeout(schedule, 160);
    const t3 = setTimeout(schedule, 280);
    const t4 = setTimeout(schedule, 420);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "style", "class"],
    });

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      mutationObserver.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step, measure]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!step || typeof document === "undefined") return null;

  const isLast = index === effectiveSteps.length - 1;

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
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else {
    const tooltipWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - 32);
    const spaceRight = window.innerWidth - (rect.left + rect.width);
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;

    let top: number;
    let left: number;
    if (spaceRight > tooltipWidth + GAP + 8) {
      left = rect.left + rect.width + GAP;
      top = rect.top;
    } else if (spaceBelow >= tooltipHeight + GAP + 12 || spaceBelow >= spaceAbove) {
      left = rect.left;
      top = rect.top + rect.height + GAP;
    } else {
      left = rect.left;
      top = rect.top - tooltipHeight - GAP;
    }
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));
    tooltipStyle = { top, left };
  }

  return createPortal(
    <div data-product-tour className="pointer-events-auto fixed inset-0 z-[100]">
      {/* Captura cliques para bloquear a UI por baixo; dim quando nao ha recorte. */}
      <div
        className={rect ? "absolute inset-0" : "absolute inset-0 bg-black/60"}
      />

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
        ref={tooltipRef}
        role="dialog"
        aria-label={step.title}
        className="absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg transition-[top,left] duration-200"
        style={tooltipStyle}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar tour"
          className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>

        <div className="pr-6">
          {effectiveSteps.length > 1 ? (
            <p className="text-xs font-medium text-muted-foreground">
              Passo {index + 1} de {effectiveSteps.length}
            </p>
          ) : null}
          <h3 className="mt-0.5 text-sm font-semibold">{step.title}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
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
            onClick={() =>
              isLast ? handleClose() : setIndex((i) => i + 1)
            }
          >
            {isLast ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
