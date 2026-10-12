"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Area com altura limitada e rolagem que avisa quando ha mais conteudo abaixo:
 * esmaece a borda de baixo e mostra um botao ("Mais abaixo") que rola a lista.
 * Mesmo padrao do "Mais campos abaixo" dos modais (DialogBody).
 */
export function ScrollCueArea({
  children,
  className,
  cueLabel = "Mais abaixo",
}: {
  children: ReactNode;
  /** Altura maxima e espacamento da lista (ex.: "max-h-48 space-y-2.5"). */
  className?: string;
  cueLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    const raf = requestAnimationFrame(check);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [check, children]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={check}
        className={cn("overflow-y-auto overscroll-contain pr-1", className)}
      >
        {children}
      </div>
      {canScrollDown ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
          />
          <button
            type="button"
            onClick={() => ref.current?.scrollBy({ top: 160, behavior: "smooth" })}
            className="absolute bottom-0 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-background/95 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur hover:text-foreground"
          >
            {cueLabel}
            <ChevronDown className="size-3 animate-bounce text-primary" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}
