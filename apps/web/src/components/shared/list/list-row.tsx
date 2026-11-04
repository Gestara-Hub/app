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
    "aria-labelledby": ariaLabelledBy,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const isClickable = Boolean(canClick && onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented && isClickable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick?.();
    }
  };

  const buttonProps = isClickable
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
      }
    : {};

  return (
    <div
      ref={ref}
      onClick={isClickable ? onClick : undefined}
      {...(isClickable ? (actions ? {} : buttonProps) : { "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy })}
      className={cn(
        // Entra com fade + deslize ao substituir o skeleton; o atraso em cascata vem
        // do ListContainer (.list-stagger). Duracao da animacao separada da do hover.
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:[animation-duration:280ms] motion-safe:ease-out",
        isClickable && "hover:bg-muted/40 cursor-pointer",
        className,
      )}
      {...rest}
    >
      <div
        {...(isClickable && actions ? buttonProps : {})}
        className={cn(
          "min-w-0 flex-1",
          isClickable && actions && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
        )}
      >
        {children}
      </div>
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
