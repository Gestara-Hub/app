import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Número de destaque de uma tela (no máximo 4 por linha, como no app dos clientes):
 * rótulo curto, valor grande e uma linha de apoio. Com `href` o cartão inteiro leva à tela do número.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="space-y-1.5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="min-w-0 break-words">{label}</span>
          {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </div>
        {sub ? <div className="min-w-0 break-words text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Grade dos cartões de número: 2 colunas no celular, até 4 no desktop. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
