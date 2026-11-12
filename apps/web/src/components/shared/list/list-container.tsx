import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListContainerProps {
  children?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
  /** Gravando por tras (ex.: toques da chamada): `aria-busy` para leitor de tela. */
  busy?: boolean;
  /**
   * Buscando a lista de novo depois de salvar (ou em segundo plano): barra fina
   * no topo e linhas levemente apagadas, sem bloquear nada. Use
   * `isFetching && !isPending` da consulta da lista.
   */
  refreshing?: boolean;
}

export function ListContainer({
  children,
  emptyState,
  className,
  busy,
  refreshing,
}: ListContainerProps) {
  return (
    <div
      // O guia na tela destaca a lista inteira no passo "lista" (features/support/guide-target).
      data-guide-list
      aria-busy={busy || refreshing || undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs",
        refreshing && "list-refreshing",
        className,
      )}
    >
      {refreshing ? (
        <div className="list-refresh-track pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden>
          <div className="list-refresh-bar h-full w-1/4 rounded-full bg-primary" />
        </div>
      ) : null}
      {emptyState ? (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {emptyState}
        </div>
      ) : (
        <div className="list-stagger divide-y divide-border/40">{children}</div>
      )}
    </div>
  );
}
