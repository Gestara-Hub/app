import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListContainerProps {
  children?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
}

export function ListContainer({
  children,
  emptyState,
  className,
}: ListContainerProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs",
        className,
      )}
    >
      {emptyState ? (
        emptyState
      ) : (
        <div className="divide-y divide-border/40">{children}</div>
      )}
    </div>
  );
}
