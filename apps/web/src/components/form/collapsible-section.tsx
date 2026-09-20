"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card transition-colors",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          open && "rounded-b-none border-b border-border/60 bg-muted/15",
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
              <span className="text-sm font-medium text-foreground truncate">
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
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-foreground",
          )}
        />
      </button>

      {open && (
        <div className={cn("p-4 space-y-4 animate-in fade-in-50 duration-150", contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}
