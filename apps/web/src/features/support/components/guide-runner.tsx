"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { trackEvent } from "@/lib/analytics";
import type { GuideStepKind, HelpChunk } from "@/lib/support/help-search";
import { routePath } from "@/lib/support/help-search";
import { findGuideElement } from "../guide-target";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;
const GAP = 12;
const TOOLTIP_WIDTH = 304;
/** Quanto esperar o elemento aparecer (a tela pode estar abrindo) antes de avisar que não achou. */
const NOT_FOUND_AFTER_MS = 3500;
/** Passos que seguem sozinhos quando a pessoa clica no destaque. */
const ADVANCES_ON_CLICK: GuideStepKind[] = ["botão", "aba", "menu", "item"];

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * Guia na tela (doc technical/26, 18.2): destaca, um passo de cada vez, o botão,
 * a aba ou o campo que a pessoa usa, e segue quando ela clica no destaque. O
 * escuro é só visual (não segura clique): quem faz é a pessoa, no sistema de
 * verdade. Os elementos são achados pelo texto da tela (`guide-target.ts`), então
 * o guia atravessa telas e janelas abertas pelo próprio passo.
 */
export function GuideRunner({ chunk, onClose }: { chunk: HelpChunk; onClose: () => void }) {
  const guide = chunk.guide!;
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(150);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);
  const scrolledRef = useRef(false);
  const step = guide.steps[index];
  const isLast = index === guide.steps.length - 1;

  const finish = useCallback(
    (completed: boolean) => {
      if (isMobile) setOpenMobile(false);
      trackEvent(completed ? "help_guide_finished" : "help_guide_closed", { guide: chunk.id, step: String(index + 1) });
      onClose();
    },
    [isMobile, setOpenMobile, chunk.id, index, onClose],
  );
  const next = useCallback(() => {
    if (isLast) finish(true);
    else setIndex((i) => i + 1);
  }, [isLast, finish]);
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // Começa na tela do guia: se a pessoa está em outra, leva até lá.
  useEffect(() => {
    trackEvent("help_guide_started", { guide: chunk.id });
    const here = `${window.location.pathname}${window.location.search}`;
    const wantsQuery = guide.route.includes("?");
    if (routePath(guide.route) !== window.location.pathname || (wantsQuery && !here.includes(guide.route.split("?")[1]))) router.push(guide.route);
    // Só na abertura do guia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Procura o alvo do passo até achar; acompanha a posição (a tela anima, rola e redimensiona).
  useEffect(() => {
    if (!step) return;
    targetRef.current = null;
    scrolledRef.current = false;
    if (isMobile && step.kind === "menu") setOpenMobile(true);
    const started = Date.now();
    const tick = () => {
      // A janela aberta (Radix) esconde do leitor de tela tudo que está fora dela, inclusive o balão.
      rootRef.current?.removeAttribute("aria-hidden");
      if (tooltipRef.current?.offsetHeight) setTooltipHeight(tooltipRef.current.offsetHeight);
      const el = targetRef.current && document.contains(targetRef.current) ? targetRef.current : findGuideElement(step);
      targetRef.current = el;
      if (!el) {
        setRect((current) => (current === null ? current : null));
        setNotFound(Date.now() - started > NOT_FOUND_AFTER_MS);
        return;
      }
      setNotFound(false);
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        el.scrollIntoView({ block: "center", inline: "nearest" });
      }
      const r = el.getBoundingClientRect();
      const measured = { top: r.top, left: r.left, width: r.width, height: r.height };
      setRect((current) => (sameRect(current, measured) ? current : measured));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [step, isMobile, setOpenMobile]);

  // Clicou no destaque: o passo seguinte vem depois que a tela reage (janela abrindo, aba trocando). Escuta
  // também o toque inicial: menus (Radix) abrem ao apertar, e o clique completo não chega ao botão.
  useEffect(() => {
    if (!step || !ADVANCES_ON_CLICK.includes(step.kind)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPress = (event: Event) => {
      const target = targetRef.current;
      if (timer || !target || !(event.target instanceof Node) || !target.contains(event.target)) return;
      timer = setTimeout(() => nextRef.current(), 350);
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("click", onPress, true);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("click", onPress, true);
      clearTimeout(timer);
    };
  }, [step]);

  // Mudou de tela num passo de texto ou campo (ex.: abriu a ficha ao clicar no nome): o passo foi cumprido.
  // Ignora a mudança que o próprio guia faz ao levar a pessoa até a tela de início.
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (Date.now() - mountedAt.current < 2000) return;
    if (step && !ADVANCES_ON_CLICK.includes(step.kind)) nextRef.current();
  }, [pathname, step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Janela aberta (Radix) fecha ao clicar ou focar fora dela: o balão fica fora do que a janela entende como "fora".
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const stop = (event: Event) => event.stopPropagation();
    const events = ["pointerdown", "mousedown", "touchstart", "focusin"] as const;
    for (const name of events) el.addEventListener(name, stop);
    return () => {
      for (const name of events) el.removeEventListener(name, stop);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (tooltipRef.current?.offsetHeight) setTooltipHeight(tooltipRef.current.offsetHeight);
  }, [index, rect]);

  if (!step || typeof document === "undefined") return null;

  const hole = rect ? { top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2 } : null;
  const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - 24);
  let place: CSSProperties;
  if (!hole) {
    place = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const below = window.innerHeight - (hole.top + hole.height);
    const above = hole.top;
    const right = window.innerWidth - (hole.left + hole.width);
    let top: number;
    let left: number;
    if (below >= tooltipHeight + GAP + 8) {
      top = hole.top + hole.height + GAP;
      left = hole.left;
    } else if (above >= tooltipHeight + GAP + 8) {
      top = hole.top - tooltipHeight - GAP;
      left = hole.left;
    } else if (right >= width + GAP + 8) {
      top = hole.top;
      left = hole.left + hole.width + GAP;
    } else {
      top = hole.top - tooltipHeight - GAP;
      left = hole.left - width - GAP;
    }
    place = {
      top: Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12)),
      left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
    };
  }
  const clickable = ADVANCES_ON_CLICK.includes(step.kind);

  return createPortal(
    <div ref={rootRef} data-guide-ui className="pointer-events-none fixed inset-0 z-[100]">
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/30" />
      )}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={chunk.title}
        className="pointer-events-auto absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg transition-[top,left] duration-200"
        style={{ width, ...place }}
      >
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label="Sair do guia"
          className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
        <p className="pr-6 text-xs font-medium text-muted-foreground">
          {chunk.title} · passo {index + 1} de {guide.steps.length}
        </p>
        <p className="mt-1.5 text-sm font-medium text-foreground">{notFound ? `Não achei isso nesta tela agora. ${step.text}` : step.text}</p>
        {clickable && !notFound ? <p className="mt-1 text-xs text-muted-foreground">Clique no destaque para seguir.</p> : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          {index > 0 ? (
            <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Voltar
            </Button>
          ) : null}
          <Button variant={clickable && !notFound ? "outline" : "default"} onClick={next}>
            {isLast ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
