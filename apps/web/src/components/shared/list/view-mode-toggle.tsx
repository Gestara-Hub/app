"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, List, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ListViewMode = "list" | "grid";

export const VIEW_MODE_STORAGE_PREFIX = "gestarahub_view_mode_";

const ViewModeServerContext = createContext<Record<string, ListViewMode>>({});

function setViewModeCookie(fullKey: string, mode: ListViewMode) {
  if (typeof document === "undefined") return;
  try {
    const shortKey = fullKey.startsWith(VIEW_MODE_STORAGE_PREFIX)
      ? fullKey.slice(VIEW_MODE_STORAGE_PREFIX.length)
      : fullKey;
    document.documentElement.setAttribute(`data-vm-${shortKey}`, mode);
    document.cookie = `${fullKey}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore cookie errors
  }
}

function syncAllLocalStorageViewModesToCookies() {
  if (typeof window === "undefined") return;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(VIEW_MODE_STORAGE_PREFIX)) {
        const val = window.localStorage.getItem(key);
        if (val === "list" || val === "grid") {
          setViewModeCookie(key, val);
        }
      }
    }
  } catch {
    // ignore storage errors
  }
}

const PRE_PAINT_VIEW_MODE_SCRIPT = `(function(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("gestarahub_view_mode_")===0){var v=localStorage.getItem(k);if(v==="list"||v==="grid"){var n=k.slice(21);document.documentElement.setAttribute("data-vm-"+n,v);document.cookie=k+"="+v+"; path=/; max-age=31536000; SameSite=Lax";}}}}catch(e){}})();`;

export function ViewModeProvider({
  initialModes = {},
  children,
}: {
  initialModes?: Record<string, ListViewMode>;
  children: ReactNode;
}) {
  useEffect(() => {
    syncAllLocalStorageViewModesToCookies();
  }, []);

  return (
    <ViewModeServerContext.Provider value={initialModes}>
      <script
        dangerouslySetInnerHTML={{ __html: PRE_PAINT_VIEW_MODE_SCRIPT }}
      />
      {children}
    </ViewModeServerContext.Provider>
  );
}

export function ViewModeSkeleton({
  storageKey,
  mode,
  list,
  grid,
}: {
  storageKey: string;
  mode: ListViewMode;
  list: ReactNode;
  grid: ReactNode;
}) {
  return (
    <>
      <div
        data-vm-skeleton={`${storageKey}:list`}
        className={mode === "grid" ? "hidden" : "block"}
      >
        {list}
      </div>
      <div
        data-vm-skeleton={`${storageKey}:grid`}
        className={mode === "grid" ? "block" : "hidden"}
      >
        {grid}
      </div>
    </>
  );
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  for (const cb of listeners) cb();
}

export function useViewMode(
  storageKey: string,
  defaultMode: ListViewMode = "list",
): [ListViewMode, (mode: ListViewMode) => void] {
  const fullKey = `${VIEW_MODE_STORAGE_PREFIX}${storageKey}`;
  const serverModes = useContext(ViewModeServerContext);
  const serverFallback = serverModes[storageKey] ?? defaultMode;

  const getSnapshot = useCallback((): ListViewMode => {
    try {
      const saved = window.localStorage.getItem(fullKey);
      if (saved === "list" || saved === "grid") {
        setViewModeCookie(fullKey, saved);
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return serverFallback;
  }, [fullKey, serverFallback]);

  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverFallback,
  );

  const updateMode = useCallback(
    (next: ListViewMode) => {
      try {
        window.localStorage.setItem(fullKey, next);
      } catch {
        // ignore storage errors
      }
      setViewModeCookie(fullKey, next);
      notify();
    },
    [fullKey],
  );

  return [mode, updateMode];
}

export function SkeletonCards({
  count = 6,
  compact = false,
  hasAvatar = true,
  showAction = true,
}: {
  count?: number;
  compact?: boolean;
  hasAvatar?: boolean;
  showAction?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {hasAvatar ? (
                <Skeleton className="size-10 shrink-0 rounded-full" />
              ) : null}
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                {!compact ? <Skeleton className="h-3.5 w-28 max-w-full" /> : null}
              </div>
            </div>
            {showAction ? (
              <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                <Skeleton className="h-4 w-1.5 rounded-full" />
              </div>
            ) : null}
          </div>
          {!compact ? (
            <div className="mt-3 border-t border-border/50 pt-2.5">
              <Skeleton className="h-4 w-44 max-w-full" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
}) {
  return (
    <div
      role="group"
      data-tour="view-mode-toggle"
      aria-label="Modo de visualização"
      className="inline-flex h-9 shrink-0 items-center rounded-md border border-input bg-background p-0.5 shadow-2xs"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        title="Visualização em lista"
        aria-label="Visualização em lista"
        aria-pressed={value === "list"}
        className={cn(
          "inline-flex h-full items-center gap-1.5 rounded-xs px-2.5 text-xs font-medium transition-colors",
          value === "list"
            ? "bg-muted text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-3.5" />
        <span className="hidden sm:inline">Lista</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Visualização em cards"
        aria-label="Visualização em cards"
        aria-pressed={value === "grid"}
        className={cn(
          "inline-flex h-full items-center gap-1.5 rounded-xs px-2.5 text-xs font-medium transition-colors",
          value === "grid"
            ? "bg-muted text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-3.5" />
        <span className="hidden sm:inline">Cards</span>
      </button>
    </div>
  );
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 340;
const GAP = 12;
const HIGHLIGHT_PADDING = 6;

/**
 * Coachmark contextual (1 passo) exibido uma unica vez quando a listagem atinge
 * `threshold` (padrao: 3) registros e nenhuma modal esta aberta.
 * Alterna automaticamente para o modo "grid" (Cards) na abertura para o usuario
 * visualizar na hora a diferenca entre Lista e Cards.
 */
export function ViewModeCoachmark({
  storageKey,
  itemCount,
  threshold = 3,
  onViewModeChange,
}: {
  storageKey: string;
  itemCount: number;
  threshold?: number;
  onViewModeChange: (mode: ListViewMode) => void;
}) {
  const seenKey = `gestarahub_coachmark_view_mode_${storageKey}`;
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (itemCount < threshold || typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(seenKey) === "1") return;
    } catch {
      return;
    }

    const tryTrigger = () => {
      try {
        if (window.localStorage.getItem(seenKey) === "1") return;
      } catch {
        return;
      }
      // Aguarda qualquer modal de cadastro/sucesso fechar antes de apresentar
      const hasOpenDialog = Boolean(
        document.querySelector(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [data-product-tour]',
        ),
      );
      if (hasOpenDialog) return;

      const targetEl = document.querySelector('[data-tour="view-mode-toggle"]');
      if (!targetEl) return;

      try {
        window.localStorage.setItem(seenKey, "1");
      } catch {
        // ignore
      }
      onViewModeChange("grid");
      setOpen(true);
    };

    const timer = setTimeout(tryTrigger, 320);
    const observer = new MutationObserver(() => {
      setTimeout(tryTrigger, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [itemCount, threshold, seenKey, onViewModeChange]);

  const measure = useCallback(() => {
    const el = document.querySelector('[data-tour="view-mode-toggle"]');
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
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
  }, [open, measure]);

  if (!open || typeof document === "undefined") return null;

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
    const tooltipWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(
        rect.left + rect.width - tooltipWidth,
        window.innerWidth - tooltipWidth - 12,
      ),
    );
    const top = Math.min(rect.top + rect.height + GAP, window.innerHeight - 220);
    tooltipStyle = { top, left };
  }

  return createPortal(
    <div data-product-tour className="pointer-events-auto fixed inset-0 z-[100]">
      <div
        className={rect ? "absolute inset-0" : "absolute inset-0 bg-black/45"}
        onClick={() => setOpen(false)}
      />

      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.42)",
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-label="Modo Lista ou Cards"
        className="absolute w-[min(21.25rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        style={tooltipStyle}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar dica"
          className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>

        <div className="pr-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="size-3" />
            Dica de visualização
          </span>
          <h3 className="mt-1.5 text-sm font-semibold">
            Alterne entre Lista e Cards
          </h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Mudamos para o modo <strong className="font-medium text-foreground">Cards</strong>{" "}
          para você conhecer! Você pode alternar aqui quando quiser — sua
          preferência fica salva em cada tela.
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onViewModeChange("list");
              setOpen(false);
            }}
          >
            Voltar para Lista
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Manter em Cards
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
