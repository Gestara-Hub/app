"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Area com altura limitada e rolagem que avisa quando ha mais conteudo:
 * esmaece a borda de baixo (e a de cima, depois de rolar) e mostra, abaixo da
 * lista, um botao de 36 px que rola a lista sem cobrir nenhuma linha.
 * Mesmo padrao do "Mais campos abaixo" dos modais (DialogBody).
 *
 * 13/11/2026: o botao fica enquanto a lista rola (no fim vira "Voltar ao
 * inicio"), entao a altura do cartao nao muda ao chegar ao fim; antes ele
 * sumia e o cartao encolhia, parecendo quebrado. Barra de rolagem fina do
 * tema (`subtle-scrollbar`), com folga para nao encostar no conteudo.
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
  const [scroll, setScroll] = useState({ overflow: false, atTop: true, atBottom: true });

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const overflow = el.scrollHeight - el.clientHeight > 6;
    const atTop = el.scrollTop <= 6;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 6;
    setScroll((prev) =>
      prev.overflow === overflow && prev.atTop === atTop && prev.atBottom === atBottom ? prev : { overflow, atTop, atBottom },
    );
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

  const { overflow, atTop, atBottom } = scroll;
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={check}
        className={cn("subtle-scrollbar overflow-y-auto overscroll-contain pr-3 pb-1 [scrollbar-gutter:stable]", className)}
      >
        {children}
      </div>
      {overflow ? (
        <>
          {/* Esmaece as bordas onde ha mais conteudo, sem cobrir a barra de rolagem. */}
          {!atTop ? (
            <div aria-hidden className="pointer-events-none absolute left-0 right-3 top-0 h-6 bg-gradient-to-b from-card to-transparent" />
          ) : null}
          {!atBottom ? (
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-3 bottom-10 h-8 bg-gradient-to-t from-card to-transparent"
            />
          ) : null}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() =>
                atBottom
                  ? ref.current?.scrollTo({ top: 0, behavior: "smooth" })
                  : ref.current?.scrollBy({ top: 160, behavior: "smooth" })
              }
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 bg-background px-3 text-xs font-medium text-muted-foreground shadow-xs hover:text-foreground"
            >
              {atBottom ? "Voltar ao início" : cueLabel}
              {atBottom ? (
                <ChevronUp className="size-3.5 text-primary" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5 animate-bounce text-primary" aria-hidden />
              )}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
