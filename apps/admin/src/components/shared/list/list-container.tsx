import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListContainerProps {
  children?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
  /** Gravando por tras (ex.: toques da chamada): `aria-busy` para leitor de tela. */
  busy?: boolean;
}

export function ListContainer({
  children,
  emptyState,
  className,
  busy,
}: ListContainerProps) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs",
        className,
      )}
    >
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
