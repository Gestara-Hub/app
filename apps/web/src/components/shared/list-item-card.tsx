import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Item de listagem (baseado no old/gestarahub-web): cartao com borda, leve
 * "lift" no hover e uma barra de acento opcional na esquerda.
 */
export function ListItemCard({
  className,
  accentClassName,
  disableHover = false,
  isActive = false,
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  accentClassName?: string;
  disableHover?: boolean;
  isActive?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-md border p-3 text-sm",
        !disableHover &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
        isActive && "-translate-y-0.5 border-foreground/20 shadow-md",
        className,
      )}
      {...props}
    >
      {accentClassName ? (
        <span className={cn("absolute inset-y-0 left-0 w-1", accentClassName)} />
      ) : null}
      {children}
    </div>
  );
}
