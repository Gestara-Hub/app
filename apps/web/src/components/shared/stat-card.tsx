import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Cartao de indicador do topo das telas (11/11/2026, doc 07 §4.1): sempre 4
 * linhas, rotulo e icone, o valor, UMA linha de apoio curta e o link para a
 * lista que forma o numero. Todos os cartoes da fileira ficam com a mesma
 * altura, sem espaco vazio (a linha de apoio nao quebra: escreva curto, sem
 * reticencias). Cartao neutro: a cor fica no icone e no valor.
 */
export type StatTone = "neutral" | "success" | "danger" | "warning" | "muted";

const ICON_TONE: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  muted: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const VALUE_TONE: Record<StatTone, string> = {
  neutral: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
};

export interface StatCardProps {
  label: ReactNode;
  icon: ReactNode;
  /** Cor do icone. */
  iconTone?: StatTone;
  value: ReactNode;
  /** Cor do valor (padrao: texto normal). */
  valueTone?: StatTone;
  /** Linha de apoio abaixo do valor: curta, cabe em uma linha. */
  sub: ReactNode;
  /** Link no pe do cartao: a lista que forma o numero ("Ver entradas"). */
  action: { label: string; href?: string; onClick?: () => void };
  /** Explicacao ao passar o mouse (o que o numero conta). */
  hint?: string;
  /**
   * O filtro deste cartao esta aplicado na lista da tela (11/11/2026): borda
   * marcada e o link vira "Limpar filtro" com X, para ficar claro que algo mudou.
   */
  active?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  icon,
  iconTone = "neutral",
  value,
  valueTone = "neutral",
  sub,
  action,
  hint,
  active = false,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <div
      title={hint}
      data-active={active || undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-2xs transition-[border-color,box-shadow] duration-200",
        active ? "border-primary/70 ring-1 ring-primary/40" : "border-border/70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4", ICON_TONE[iconTone])}>{icon}</div>
      </div>
      <div className="mt-2">
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className={cn("text-xl font-bold tabular-nums sm:text-2xl", VALUE_TONE[valueTone])}>{value}</div>
        )}
        <div className="mt-0.5 text-xs text-muted-foreground">{isLoading ? "—" : sub}</div>
      </div>
      <div className="mt-auto pt-2.5">
        {action.href ? (
          <Link href={action.href} className={ACTION_CLASS}>
            {action.label} <ChevronRight className="size-3" />
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} aria-pressed={active} className={ACTION_CLASS}>
            {action.label} {active ? <X className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

const ACTION_CLASS =
  "inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none";
