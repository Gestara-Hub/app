import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bloco aberto das abas de Configurações (31/10/2026: sem sanfona, os campos
 * ficam à vista). Ícone, título e uma linha de descrição; os campos embaixo.
 */
export function SettingsSection({
  icon,
  title,
  description,
  children,
  className,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <section
      {...props}
      className={cn("rounded-xl border border-border/70 bg-card px-5 py-5 shadow-xs sm:px-6", className)}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
