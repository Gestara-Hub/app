"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  badge,
  open,
  onOpenChange,
  children,
  className,
  contentClassName,
  headerClassName,
}: CollapsibleSectionProps) {
  // Mesmo comportamento das secoes da ficha do aluno (doc 07 §1.8): aberta, a
  // parte inteira ganha fundo e uma barra fina a esquerda, e abre e fecha deslizando.
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card transition-colors duration-300",
        open && "bg-muted/40 dark:bg-muted/25",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-1 w-[3px] origin-top rounded-full bg-foreground/60 transition-[opacity,transform] duration-300",
          open ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
        )}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
          open ? "hover:bg-muted/60" : "hover:bg-muted/40",
          headerClassName,
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("min-w-0 text-sm text-foreground break-words", open ? "font-semibold" : "font-medium")}>
                {title}
              </span>
              {badge && (
                typeof badge === "string" ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {badge}
                  </span>
                ) : (
                  badge
                )
              )}
            </div>
            {subtitle && (
              <p className="min-w-0 text-xs text-muted-foreground break-words">{subtitle}</p>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180 text-foreground",
          )}
        />
      </button>

      <CollapsibleContent>
        <div className={cn("px-4 pt-1 pb-5 space-y-4", contentClassName)}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
