"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { GuideStepKind, HelpChunk } from "@/lib/support/help-search";
import { routePath } from "@/lib/support/help-search";
import { isGuideTargetDisabled, pressGuideTarget } from "../guide-press";
import { findGuideElement, openLayers } from "../guide-target";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 4;
/** Quanto esperar o elemento aparecer (a tela pode estar abrindo) antes de avisar que não achou. */
const NOT_FOUND_AFTER_MS = 3500;
/** Quanto a janela pode sumir (animação, troca de janela) antes de o guia voltar ao passo que a abriu. */
const LAYER_GONE_AFTER_MS = 700;
/** Tempo para a tela reagir ao clique (janela abrindo, aba trocando) antes do passo seguinte. */
const AFTER_PRESS_MS = 350;
/** Passos que seguem sozinhos quando a pessoa clica no destaque. */
const ADVANCES_ON_CLICK: GuideStepKind[] = ["botão", "aba", "menu", "item"];

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

type StepStatus = "searching" | "found" | "notFound";

/**
 * Guia na tela em painel lateral (11/11/2026, doc technical/26 18.5; antes era
 * um balão com a tela escurecida). O painel mostra todos os passos, marca os
 * feitos e destaca o alvo do passo atual com um contorno leve, sem escurecer
 * nem segurar clique: quem faz é a pessoa, no sistema de verdade.
 *
 * Ordem garantida: um passo só fica ativo quando o anterior aconteceu.
 * - Clique (`botão`, `aba`, `menu`, `item`): segue quando a pessoa clica no
 *   destaque, ou em "Fazer por mim".
 * - `lista`: segue quando a pessoa abre um item (muda de tela ou abre janela).
 * - `campo`, `texto`, `card`: "Próximo", ligado só com o alvo na tela.
 * Se um passo abriu uma janela, os seguintes procuram só nela; se ela fecha
 * antes do fim, o guia volta ao passo que a abriu.
 */
export function GuidePanel({ chunk, onClose }: { chunk: HelpChunk; onClose: () => void }) {
  const guide = chunk.guide!;
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Situação da busca do alvo, presa ao passo (trocar de passo volta a "procurando").
  const [search, setSearch] = useState<{ index: number; status: StepStatus }>({ index: 0, status: "searching" });
  const status: StepStatus = search.index === index ? search.status : "searching";
  // Passo que abriu a janela onde os seguintes acontecem (null: na tela).
  const [layerOwner, setLayerOwner] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Lista inteira de passos aberta? Sem escolha da pessoa: aberta no computador, só o passo atual no celular.
  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null);
  const expanded = expandedChoice ?? !isMobile;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);
  const scrolledRef = useRef(false);
  const layersAtStepStart = useRef(0);
  const layerGoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const goTo = useCallback(
    (target: number) => {
      setNotice(null);
      setLayerOwner((owner) => (owner !== null && target <= owner ? null : owner));
      setIndex(target);
    },
    [],
  );

  /** Passo que pediu uma janela que ainda nao tinha aberto no tempo do clique. */
  const ownerCandidate = useRef<{ owner: number; before: number } | null>(null);
  /** Passo cumprido. `layersBefore`: janelas abertas antes do clique, para saber se o passo abriu ou fechou uma. */
  const complete = useCallback(
    (layersBefore?: number) => {
      ownerCandidate.current = null;
      if (layersBefore !== undefined) {
        const now = openLayers().length;
        if (now > layersBefore) setLayerOwner(index);
        else if (now < layersBefore) setLayerOwner(null);
        // A janela ainda nao abriu (gaveta que carrega depois): confere nos proximos ciclos.
        else ownerCandidate.current = { owner: index, before: layersBefore };
      }
      setNotice(null);
      if (isLast) finish(true);
      else setIndex(index + 1);
    },
    [index, isLast, finish],
  );
  const completeRef = useRef(complete);
  useEffect(() => {
    completeRef.current = complete;
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

  // Procura o alvo do passo até achar e acompanha a posição (a tela anima, rola e redimensiona).
  useEffect(() => {
    if (!step) return;
    targetRef.current = null;
    scrolledRef.current = false;
    if (layerGoneTimer.current) {
      clearTimeout(layerGoneTimer.current);
      layerGoneTimer.current = null;
    }
    layersAtStepStart.current = openLayers().length;
    const stepIndex = index;
    const setStatus = (value: StepStatus) =>
      setSearch((current) => (current.index === stepIndex && current.status === value ? current : { index: stepIndex, status: value }));
    if (isMobile && step.kind === "menu") setOpenMobile(true);
    let notFoundTimer: ReturnType<typeof setTimeout> | null = null;
    const clearNotFoundTimer = () => {
      if (!notFoundTimer) return;
      clearTimeout(notFoundTimer);
      notFoundTimer = null;
    };
    const tick = () => {
      // A janela aberta (Radix) esconde do leitor de tela tudo que está fora dela, inclusive o painel.
      rootRef.current?.removeAttribute("aria-hidden");
      const layers = openLayers().length;

      // A janela do passo anterior abriu depois do tempo do clique (11/11/2026): agora e dele.
      const candidate = ownerCandidate.current;
      if (candidate && layers > candidate.before) {
        ownerCandidate.current = null;
        setLayerOwner(candidate.owner);
      }

      // A janela que um passo anterior abriu fechou antes do fim: volta ao passo que a abriu.
      if (layerOwner !== null && layers === 0) {
        clearNotFoundTimer();
        layerGoneTimer.current ??= setTimeout(() => {
          layerGoneTimer.current = null;
          setNotice("A janela fechou. Abra de novo para continuar.");
          setLayerOwner(null);
          setIndex(layerOwner);
        }, LAYER_GONE_AFTER_MS);
        setRect((current) => (current === null ? current : null));
        return;
      }
      if (layerGoneTimer.current) {
        clearTimeout(layerGoneTimer.current);
        layerGoneTimer.current = null;
      }

      // Passo de lista: abrir um item numa janela cumpre o passo.
      if (step.kind === "lista" && layers > layersAtStepStart.current) {
        completeRef.current(layersAtStepStart.current);
        return;
      }

      const el = targetRef.current && document.contains(targetRef.current) ? targetRef.current : findGuideElement(step);
      targetRef.current = el;
      if (!el) {
        setRect((current) => (current === null ? current : null));
        if (!notFoundTimer) {
          setStatus("searching");
          notFoundTimer = setTimeout(() => setStatus("notFound"), NOT_FOUND_AFTER_MS);
        }
        return;
      }
      clearNotFoundTimer();
      setStatus("found");
      const r = el.getBoundingClientRect();
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? "start" : "center", inline: "nearest" });
      }
      const measured = { top: r.top, left: r.left, width: r.width, height: r.height };
      setRect((current) => (sameRect(current, measured) ? current : measured));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => {
      clearInterval(timer);
      clearNotFoundTimer();
      if (layerGoneTimer.current) {
        clearTimeout(layerGoneTimer.current);
        layerGoneTimer.current = null;
      }
    };
  }, [step, index, layerOwner, isMobile, setOpenMobile]);

  // Clicou no destaque: o passo seguinte vem depois que a tela reage. Escuta também o toque
  // inicial: menus (Radix) abrem ao apertar, e o clique completo não chega ao botão.
  useEffect(() => {
    if (!step || !ADVANCES_ON_CLICK.includes(step.kind)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPress = (event: Event) => {
      const target = targetRef.current;
      if (timer || !target || !(event.target instanceof Node) || !target.contains(event.target)) return;
      const before = openLayers().length;
      timer = setTimeout(() => completeRef.current(before), AFTER_PRESS_MS);
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("click", onPress, true);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("click", onPress, true);
      clearTimeout(timer);
    };
  }, [step]);

  // Mudou de tela num passo que não é de clique (ex.: abriu a ficha ao clicar no nome): o passo foi cumprido.
  // Ignora a mudança que o próprio guia faz ao levar a pessoa até a tela de início.
  const ignoringInitialNav = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      ignoringInitialNav.current = false;
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (ignoringInitialNav.current) return;
    if (step && !ADVANCES_ON_CLICK.includes(step.kind)) completeRef.current();
  }, [pathname, step]);

  // Esc fecha o guia só sem janela aberta (com janela, o Esc é dela). Na fase de
  // captura (11/11/2026): sem ela, o Radix fechava a janela antes e o guia via
  // "nenhuma janela" e fechava junto, em vez de voltar ao passo que a abriu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openLayers().length === 0) finish(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish]);

  // Janela aberta (Radix) fecha ao clicar ou focar fora dela: o painel fica fora do que ela entende como "fora".
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (event: Event) => event.stopPropagation();
    const events = ["pointerdown", "mousedown", "touchstart", "focusin"] as const;
    for (const name of events) el.addEventListener(name, stop);
    return () => {
      for (const name of events) el.removeEventListener(name, stop);
    };
  }, []);

  // "Fazer por mim": clica no destaque; o passo segue pelo mesmo caminho do clique da pessoa (acima).
  const doItForMe = () => {
    const el = targetRef.current;
    if (!(el instanceof HTMLElement)) return;
    if (isGuideTargetDisabled(el)) {
      setNotice("Este botão está desligado agora. Confira o passo anterior.");
      return;
    }
    trackEvent("help_guide_did_for_me", { guide: chunk.id, step: String(index + 1) });
    pressGuideTarget(el);
  };

  if (!step || typeof document === "undefined") return null;

  const clickable = ADVANCES_ON_CLICK.includes(step.kind);
  const found = status === "found" && rect !== null;
  const hint =
    notice ??
    (status === "notFound"
      ? layerOwner === null && index > 0
        ? "Não achei isso na tela agora. Volte um passo ou pule este."
        : "Não achei isso na tela agora. Pule este passo para seguir."
      : status === "searching"
        ? layerOwner !== null || index === 0
          ? "Esperando a tela abrir…"
          : "Procurando na tela…"
        : clickable
          ? "Clique no destaque ou em “Fazer por mim”."
          : step.kind === "lista"
            ? "Clique em um item da lista destacada."
            : null);

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "notFound" ? (
        <Button variant="outline" onClick={() => complete()}>
          {isLast ? "Concluir" : "Pular este passo"}
        </Button>
      ) : clickable ? (
        <Button onClick={doItForMe} disabled={!found}>
          Fazer por mim
        </Button>
      ) : step.kind === "lista" ? null : (
        <Button onClick={() => complete()} disabled={!found}>
          {isLast ? "Concluir" : "Próximo"}
        </Button>
      )}
    </div>
  );

  return createPortal(
    <div ref={rootRef} data-guide-ui className="pointer-events-none fixed inset-0 z-[100]">
      {found ? (
        <div
          aria-hidden
          className="guide-pulse pointer-events-none absolute rounded-lg bg-primary/[0.06] ring-2 ring-primary transition-[top,left,width,height] duration-200"
          style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2 }}
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Passo a passo: ${chunk.title}`}
        className={cn(
          "pointer-events-auto absolute flex max-h-[70dvh] flex-col rounded-xl border bg-popover text-popover-foreground shadow-xl",
          "inset-x-2 bottom-2 md:inset-x-auto md:right-4 md:bottom-4 md:w-80",
        )}
      >
        <div className="flex items-start gap-2 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Passo a passo · {index + 1} de {guide.steps.length}
            </p>
            <p className="min-w-0 break-words text-sm font-semibold text-foreground">{chunk.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpandedChoice(!expanded)}
            aria-label={expanded ? "Mostrar só o passo atual" : "Mostrar todos os passos"}
            aria-expanded={expanded}
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label="Sair do guia"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="h-0.5 bg-muted">
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / guide.steps.length) * 100}%` }} />
        </div>

        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {guide.steps.map((s, i) => {
            const done = i < index;
            const current = i === index;
            if (!expanded && !current) return null;
            return (
              <li key={i}>
                <div className={cn("rounded-lg px-2 py-2", current && "bg-muted/60")}>
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    title={done ? "Voltar a este passo" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 text-left text-sm",
                      done ? "cursor-pointer text-muted-foreground hover:text-foreground" : "cursor-default",
                      !done && !current && "text-muted-foreground/70",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary text-primary",
                      )}
                    >
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span className={cn("min-w-0 break-words", current && "font-medium text-foreground")}>{s.text}</span>
                  </button>
                  {current ? (
                    <div className="mt-2 space-y-2 pl-7.5">
                      {hint ? (
                        <p
                          role="status"
                          className={cn(
                            "text-xs",
                            notice || status === "notFound" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                          )}
                        >
                          {hint}
                        </p>
                      ) : null}
                      {actions}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
