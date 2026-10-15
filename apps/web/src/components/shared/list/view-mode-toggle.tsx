"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LayoutGrid, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProductTour } from "@/components/shared/product-tour";
import {
  DEFAULT_VIEW_MODE,
  resolveViewMode,
  shouldShowViewModeTip,
  VIEW_MODE_STORAGE_PREFIX,
  VIEW_MODE_TIP_MIN_ITEMS,
  viewModeTipSeenKey,
  type ListViewMode,
} from "./view-mode-script";

const ViewModeServerContext = createContext<Record<string, ListViewMode>>({});

function shortKeyOf(fullKey: string): string {
  return fullKey.startsWith(VIEW_MODE_STORAGE_PREFIX)
    ? fullKey.slice(VIEW_MODE_STORAGE_PREFIX.length)
    : fullKey;
}

function setViewModeCookie(fullKey: string, mode: ListViewMode) {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.setAttribute(`data-vm-${shortKeyOf(fullKey)}`, mode);
    document.cookie = `${fullKey}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore cookie errors
  }
}

/**
 * Sem escolha salva no localStorage: o cookie (SSR) nao vale mais e a tela
 * volta para Lista. So escreve quando ha algo antigo para limpar.
 */
function clearViewModeCookie(fullKey: string) {
  if (typeof document === "undefined") return;
  try {
    const attr = `data-vm-${shortKeyOf(fullKey)}`;
    if (document.documentElement.getAttribute(attr) !== DEFAULT_VIEW_MODE) {
      document.documentElement.setAttribute(attr, DEFAULT_VIEW_MODE);
    }
    if (document.cookie.split("; ").some((c) => c.startsWith(`${fullKey}=`))) {
      document.cookie = `${fullKey}=; path=/; max-age=0; SameSite=Lax`;
    }
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
    // Cookie sem o valor no localStorage (dados limpos, demo reiniciada) sai.
    for (const entry of document.cookie ? document.cookie.split("; ") : []) {
      const name = entry.split("=")[0];
      if (name.startsWith(VIEW_MODE_STORAGE_PREFIX)) {
        const val = window.localStorage.getItem(name);
        if (val !== "list" && val !== "grid") clearViewModeCookie(name);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function ViewModeProvider({
  initialModes = {},
  children,
}: {
  initialModes?: Record<string, ListViewMode>;
  children: ReactNode;
}) {
  // O script antes da pintura fica no root layout (PRE_PAINT_VIEW_MODE_SCRIPT).
  useEffect(() => {
    syncAllLocalStorageViewModesToCookies();
  }, []);

  return (
    <ViewModeServerContext.Provider value={initialModes}>
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
  defaultMode: ListViewMode = DEFAULT_VIEW_MODE,
): [ListViewMode, (mode: ListViewMode) => void] {
  const fullKey = `${VIEW_MODE_STORAGE_PREFIX}${storageKey}`;
  const serverModes = useContext(ViewModeServerContext);
  const serverFallback = serverModes[storageKey] ?? defaultMode;

  // No navegador o localStorage manda: sem escolha salva, o padrao (Lista),
  // mesmo que um cookie antigo diga "grid" (o cookie so evita o flicker no SSR).
  const getSnapshot = useCallback((): ListViewMode => {
    try {
      const saved = window.localStorage.getItem(fullKey);
      if (saved === "list" || saved === "grid") {
        setViewModeCookie(fullKey, saved);
        return saved;
      }
    } catch {
      // Sem localStorage (bloqueado): fica o que o servidor leu do cookie.
      return serverFallback;
    }
    clearViewModeCookie(fullKey);
    return resolveViewMode(null, defaultMode);
  }, [fullKey, defaultMode, serverFallback]);

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
  tipKey,
  itemCount,
}: {
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  /**
   * Chave da tela (a mesma do `useViewMode`): com `itemCount`, mostra uma vez
   * a dica "Lista ou cards" quando a tela ganha o 1º registro.
   */
  tipKey?: string;
  itemCount?: number;
}) {
  return (
    <>
      <div
        role="group"
        data-tour="view-mode-toggle"
        data-view-mode-key={tipKey}
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
          title="Visualização em cartões"
          aria-label="Visualização em cartões"
          aria-pressed={value === "grid"}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-xs px-2.5 text-xs font-medium transition-colors",
            value === "grid"
              ? "bg-muted text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" />
          <span className="hidden sm:inline">Cartões</span>
        </button>
      </div>
      {tipKey && itemCount !== undefined ? (
        <ViewModeCoachmark storageKey={tipKey} itemCount={itemCount} />
      ) : null}
    </>
  );
}

function toggleSelector(storageKey: string): string {
  return `[data-tour="view-mode-toggle"][data-view-mode-key="${storageKey}"]`;
}

const UNKEYED_TOGGLE = '[data-tour="view-mode-toggle"]:not([data-view-mode-key])';

/** Seletor do toggle da tela (o da chave; sem chave marcada, o unico da pagina). */
function findToggleSelector(storageKey: string): string | null {
  if (document.querySelector(toggleSelector(storageKey))) return toggleSelector(storageKey);
  if (document.querySelector(UNKEYED_TOGGLE)) return UNKEYED_TOGGLE;
  return null;
}

/**
 * Dica de 1 passo, uma vez por tela (`viewModeTipSeenKey`), quando a listagem
 * tem pelo menos 1 registro e nenhum modal ou tour esta aberto. Usa o mesmo
 * tour do produto (`ProductTour`, destaque no toggle + balao) e nao troca o
 * modo da tela: a lista continua em Lista.
 */
export function ViewModeCoachmark({
  storageKey,
  itemCount,
  threshold = VIEW_MODE_TIP_MIN_ITEMS,
}: {
  storageKey: string;
  itemCount: number;
  threshold?: number;
}) {
  const seenKey = viewModeTipSeenKey(storageKey);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isSeen = () => {
      try {
        return window.localStorage.getItem(seenKey) === "1";
      } catch {
        return true;
      }
    };
    if (!shouldShowViewModeTip(itemCount, isSeen(), threshold)) return;

    const tryTrigger = () => {
      if (isSeen()) return;
      // Espera o modal de cadastro/sucesso (ou outro tour) fechar.
      const hasOpenDialog = Boolean(
        document.querySelector(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [data-slot="sheet-content"], [data-product-tour]',
        ),
      );
      if (hasOpenDialog) return;
      const selector = findToggleSelector(storageKey);
      if (!selector) return;

      try {
        window.localStorage.setItem(seenKey, "1");
      } catch {
        // ignore
      }
      setTarget(selector);
    };

    const timer = setTimeout(tryTrigger, 400);
    let pending: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(tryTrigger, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(pending);
      observer.disconnect();
    };
  }, [itemCount, threshold, seenKey, storageKey]);

  if (!target) return null;
  return (
    <ProductTour
      steps={[
        {
          target,
          title: "Veja em lista ou em cartões",
          body: "Troque a visão aqui. Cada tela guarda sua escolha.",
        },
      ]}
      onClose={() => setTarget(null)}
      mobileMenuStep={false}
      finishLabel="Entendi"
    />
  );
}
