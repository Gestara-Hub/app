"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  Clock,
  RotateCw,
  Scale,
  WalletCards,
} from "lucide-react";
import type {
  FinanceCategoryTotal,
  FinanceMonthPoint,
  FinanceSummary,
  FinanceUpcomingItem,
  FinancialEntryType,
} from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import {
  useFinanceByCategory,
  useFinanceSeries,
  useFinanceSummary,
  useFinanceUpcoming,
} from "../hooks/use-finance";
import { useFinanceUrlState } from "../hooks/use-finance-url-state";
import { competenceLabel } from "../lib";
import { billingHref, fullDate, shortDate } from "../finance-ui";
import { FinanceCashFlowChart } from "./finance-cash-flow-chart";

const SERIES_MONTHS = 6;
const UPCOMING_DAYS = 7;

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card p-4 shadow-2xs sm:p-5", className)}>
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertTriangle className="size-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

// --- Cartoes ---------------------------------------------------------------

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  footer,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "neutral" | "success" | "destructive" | "warning";
  footer?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-4 shadow-2xs",
        tone === "destructive" ? "border-destructive/30 bg-destructive/5" : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            tone === "success" && "bg-success/10 text-success",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "warning" && "bg-warning/10 text-warning",
            tone === "neutral" && "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <div
          className={cn(
            "text-xl font-bold tabular-nums sm:text-2xl",
            tone === "destructive" ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        {footer}
      </div>
    </div>
  );
}

function KpiCards({ summary }: { summary: FinanceSummary }) {
  const negative = summary.resultCents < 0;
  const hasOverdue = summary.incomeOverdueCents > 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Entrou no mês"
        value={formatCents(summary.incomePaidCents)}
        hint={
          summary.incomeForecastCents > 0
            ? `A receber em aberto: ${formatCents(summary.incomeForecastCents)}`
            : "Nenhuma entrada pendente no mês"
        }
        icon={<ArrowDownCircle className="size-4" />}
        tone="success"
      />
      <KpiCard
        label="Saiu no mês"
        value={formatCents(summary.expensePaidCents)}
        hint={
          summary.expenseOverdueCents > 0
            ? `${formatCents(summary.expenseOverdueCents)} em contas vencidas`
            : summary.expenseForecastCents > 0
              ? `A pagar em aberto: ${formatCents(summary.expenseForecastCents)}`
              : "Nenhuma conta pendente no mês"
        }
        icon={<ArrowUpCircle className="size-4" />}
        tone={summary.expenseOverdueCents > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        label="Resultado do mês"
        value={formatCents(summary.resultCents)}
        hint={negative ? "Saiu mais do que entrou" : "Saldo líquido (entrou − saiu)"}
        icon={<Scale className="size-4" />}
        tone={negative ? "destructive" : "success"}
      />
      <KpiCard
        label="Em atraso"
        value={formatCents(summary.incomeOverdueCents)}
        hint={hasOverdue ? "Entradas vencidas no mês" : "Nenhuma cobrança vencida"}
        icon={<AlertCircle className="size-4" />}
        tone={hasOverdue ? "destructive" : "neutral"}
        footer={
          hasOverdue ? (
            <Link
              href={billingHref(summary.competence, { status: "overdue" })}
              className="mt-1 inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-primary hover:underline"
            >
              Ver cobranças atrasadas
              <ChevronRight className="size-3.5 shrink-0" />
            </Link>
          ) : null
        }
      />
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="size-7 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-1.5 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

// --- Grafico ---------------------------------------------------------------

function SeriesPanel({
  points,
  isPending,
  isError,
  onRetry,
}: {
  points?: FinanceMonthPoint[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const empty = (points ?? []).every((p) => p.incomeCents === 0 && p.expenseCents === 0);
  return (
    <Panel
      title="Entradas × saídas"
      description={`Pago nos últimos ${SERIES_MONTHS} meses, com o resultado de cada mês.`}
      className="lg:col-span-3"
    >
      {isPending ? (
        <Skeleton className="h-52 w-full rounded-lg" />
      ) : isError ? (
        <RetryBlock message="Não foi possível carregar o gráfico." onRetry={onRetry} />
      ) : empty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhum valor pago nos últimos {SERIES_MONTHS} meses.
        </p>
      ) : (
        <FinanceCashFlowChart points={points ?? []} />
      )}
    </Panel>
  );
}

// --- Por categoria -----------------------------------------------------------

function CategoryColumn({
  type,
  items,
  onSelectCategory,
}: {
  type: FinancialEntryType;
  items: FinanceCategoryTotal[];
  onSelectCategory?: () => void;
}) {
  const list = items.filter((i) => i.type === type);
  const total = list.reduce((s, i) => s + i.totalCents, 0);
  const title = type === "income" ? "Entradas" : "Saídas";
  return (
    <div className={type === "expense" ? "pt-4" : undefined}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <span className="text-xs font-semibold tabular-nums text-foreground">{formatCents(total)}</span>
      </div>
      {list.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          {type === "income" ? "Nenhuma entrada paga no mês." : "Nenhuma saída paga no mês."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((item) => (
            <li key={item.categoryId}>
              <button
                type="button"
                onClick={onSelectCategory}
                className="group w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.categoryName}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-foreground">{formatCents(item.totalCents)}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {String(item.percent).replace(".", ",")}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", type === "income" ? "bg-chart-2" : "bg-chart-1")}
                    style={{ width: `${Math.max(2, item.percent)}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryPanel({
  items,
  isPending,
  isError,
  onRetry,
  onSelectCategory,
}: {
  items?: FinanceCategoryTotal[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectCategory?: () => void;
}) {
  return (
    <Panel title="Por categoria" description="O que foi pago no mês, agrupado por categoria." className="lg:col-span-2">
      {isPending ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-1.5 w-2/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <RetryBlock message="Não foi possível carregar as categorias." onRetry={onRetry} />
      ) : (
        <div className="divide-y divide-border/50 space-y-4">
          <CategoryColumn type="income" items={items ?? []} onSelectCategory={onSelectCategory} />
          <CategoryColumn type="expense" items={items ?? []} onSelectCategory={onSelectCategory} />
        </div>
      )}
    </Panel>
  );
}

// --- Proximos vencimentos ----------------------------------------------------

function UpcomingPanel({
  items,
  isPending,
  isError,
  onRetry,
  onOpenEntries,
  onOpenTeachers,
}: {
  items?: FinanceUpcomingItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenEntries: () => void;
  onOpenTeachers: () => void;
}) {
  const list = items ?? [];
  const total = list.reduce((s, i) => s + i.amountCents, 0);
  return (
    <Panel
      title="Próximos vencimentos"
      description={`Contas a pagar e pagamentos de professores nos próximos ${UPCOMING_DAYS} dias.`}
      className="lg:col-span-5"
    >
      {isPending ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <RetryBlock message="Não foi possível carregar os vencimentos." onRetry={onRetry} />
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada para pagar nos próximos {UPCOMING_DAYS} dias.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border/50">
            {list.map((item) => (
              <li key={`${item.source}:${item.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex w-12 shrink-0 flex-col items-center rounded-md border px-1 py-1 text-center",
                      item.overdue ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border/60 text-foreground",
                    )}
                    title={fullDate(item.dueDate)}
                  >
                    <span className="text-xs font-semibold tabular-nums">{shortDate(item.dueDate)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.overdue ? (
                        <>
                          <AlertCircle className="size-3 text-destructive" aria-hidden />
                          <span className="text-destructive">Vencido</span>
                        </>
                      ) : (
                        <>
                          <Clock className="size-3" aria-hidden />
                          {item.source === "teacher_payout" ? "Pagamento de professor" : "Conta a pagar"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCents(item.amountCents)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={item.source === "teacher_payout" ? onOpenTeachers : onOpenEntries}
                    className="h-7 px-2 text-xs text-primary hover:text-primary"
                  >
                    {item.source === "teacher_payout" ? "Ver professor" : "Ver conta"}
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border/50 pt-3 text-right text-xs text-muted-foreground">
            {plural(list.length, "vencimento", "vencimentos")} · total{" "}
            <span className="font-medium tabular-nums text-foreground">{formatCents(total)}</span>
          </p>
        </>
      )}
    </Panel>
  );
}

// --- Aba --------------------------------------------------------------------

/**
 * Resumo do mes: cartoes, grafico dos ultimos 6 meses, totais por categoria e
 * proximos vencimentos (docs/technical/05, 7.1).
 */
export function FinanceSummaryTab({
  competence,
  onCreateEntry,
}: {
  competence: string;
  onCreateEntry?: () => void;
}) {
  const summary = useFinanceSummary(competence);
  const series = useFinanceSeries(SERIES_MONTHS, competence);
  const byCategory = useFinanceByCategory(competence);
  const upcoming = useFinanceUpcoming(UPCOMING_DAYS);
  const { setTab } = useFinanceUrlState();
  const can = useCan();
  const canManage = can("finance:manage");

  if (summary.isError) {
    return (
      <div className="rounded-xl border border-border/70 bg-card">
        <RetryBlock message="Não foi possível carregar o resumo do mês." onRetry={() => summary.refetch()} />
      </div>
    );
  }

  const s = summary.data;
  const monthIsEmpty =
    s !== undefined &&
    s.incomePaidCents === 0 &&
    s.expensePaidCents === 0 &&
    s.incomeForecastCents === 0 &&
    s.expenseForecastCents === 0;
  const seriesIsEmpty =
    series.data !== undefined && series.data.every((p) => p.incomeCents === 0 && p.expenseCents === 0);

  if (monthIsEmpty && seriesIsEmpty && (upcoming.data?.length ?? 0) === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card">
        <ModuleEmptyGuide
          icon={<WalletCards className="size-7" />}
          title={`Nenhum movimento em ${competenceLabel(competence).toLowerCase()}`}
          description="As mensalidades pagas entram aqui sozinhas. Lance também as outras receitas e as despesas do negócio para ver o resultado do mês."
          actionLabel={canManage ? "Novo lançamento" : undefined}
          onAction={canManage ? (onCreateEntry ?? (() => setTab("lancamentos"))) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {s ? <KpiCards summary={s} /> : <KpiSkeleton />}

      <div className="grid gap-4 lg:grid-cols-5">
        <SeriesPanel
          points={series.data}
          isPending={series.isPending}
          isError={series.isError}
          onRetry={() => series.refetch()}
        />
        <CategoryPanel
          items={byCategory.data}
          isPending={byCategory.isPending}
          isError={byCategory.isError}
          onRetry={() => byCategory.refetch()}
          onSelectCategory={() => setTab("lancamentos")}
        />
        <UpcomingPanel
          items={upcoming.data}
          isPending={upcoming.isPending}
          isError={upcoming.isError}
          onRetry={() => upcoming.refetch()}
          onOpenEntries={() => setTab("lancamentos")}
          onOpenTeachers={() => setTab("professores")}
        />
      </div>
    </div>
  );
}
