"use client";

import { forwardRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  canClick?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  {
    children,
    actions,
    onClick,
    canClick = Boolean(onClick),
    className,
    "aria-label": ariaLabel,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented && canClick && onClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={ref}
      onClick={canClick ? onClick : undefined}
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={cn(
        // Entra com fade + deslize ao substituir o skeleton; o atraso em cascata vem
        // do ListContainer (.list-stagger). Duracao da animacao separada da do hover.
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:[animation-duration:280ms] motion-safe:ease-out",
        canClick && "cursor-pointer",
        className,
      )}
      {...rest}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? (
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
});
