import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedItem {
  value: string;
  label: string;
  /** Número ao lado do rótulo (ex.: conversas esperando). */
  count?: number;
}

/**
 * Escolha de uma opção por endereço (`?tab=`, `?status=`): cada uma é um link e a página
 * renderiza só a ativa no servidor. Visual de controle segmentado, igual ao do app dos clientes.
 */
export function SegmentedLinks({
  items,
  active,
  href,
  label,
  className,
}: {
  items: SegmentedItem[];
  active: string;
  href: (value: string) => string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1", className)}>
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <Link
            key={item.value}
            href={href(item.value)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count ? <span className="rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary tabular-nums">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
