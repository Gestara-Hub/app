"use client";

import { useTeamWords } from "@/features/settings";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  RotateCw,
  Wallet,
  WalletCards,
} from "lucide-react";
import type {
  FinanceCategoryTotal,
  FinanceMonthPoint,
  FinanceSummary,
  FinanceUpcomingItem,
} from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { competenceLabel, financeHref, payablesSubtitle } from "../lib";
import { billingHref, earlierOverdueBillingHref, overdueEarlierCents, shortDate } from "../finance-ui";
import { FinanceCashFlowChart } from "./finance-cash-flow-chart";

const SERIES_MONTHS = 6;
const UPCOMING_DAYS = 7;
function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertTriangle className="size-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-64 rounded-2xl lg:col-span-7" />
        <Skeleton className="h-64 rounded-2xl lg:col-span-5" />
      </div>
    </div>
  );
}

// ===========================================================================
// RESUMO DO MES (11/11/2026: uma tela so, no lugar de Simplificada e Avancada)
// ===========================================================================
/** Quantas contas a pagar aparecem no quadro; o resto fica em Lancamentos. */
const PAYABLES_SHOWN = 5;

function SummaryContent({
  competence,
  summary,
  series,
  categories,
  upcoming,
}: {
  competence: string;
  summary: FinanceSummary;
  series?: FinanceMonthPoint[];
  categories?: FinanceCategoryTotal[];
  upcoming?: FinanceUpcomingItem[];
}) {
  const isPositive = summary.resultCents >= 0;
  // Margem do mes na linha do Saldo (era o selo da Avancada e o "Equilibrio do mes").
  const marginPct =
    summary.incomePaidCents > 0 ? Math.round((summary.resultCents / summary.incomePaidCents) * 100) : null;
  // Previsao com o que falta receber e pagar: so na dica, os dois valores ja
  // estao nos cartoes Entrou e Saiu.
  const projected = summary.resultCents + summary.incomeForecastCents - summary.expenseForecastCents;
  const hasPending = summary.incomeForecastCents > 0 || summary.expenseForecastCents > 0;
  // O valor e o atraso do mes (o mesmo de Cobrancas e Lancamentos); o de meses
  // anteriores vem na linha de baixo (11/11/2026).
  const overdueCents = summary.incomeOverdueCents;
  const earlierCents = overdueEarlierCents(summary.overdueToDate, competence);
  const hasOverdue = overdueCents > 0 || earlierCents > 0;
  // Cada numero abre a lista que o forma: o do mes abre Cobrancas do mes em
  // "Em atraso"; o de meses anteriores, so os meses anteriores.
  const overdueHref =
    overdueCents > 0 || earlierCents === 0
      ? billingHref(competence, { status: "overdue" })
      : earlierOverdueBillingHref(competence);
  const earlierHref = earlierOverdueBillingHref(competence);

  return (
    <div className="space-y-5">
      {/* Indicadores do mes: o mesmo cartao de Cobrancas (StatCard), cada um com
          uma linha curta e o link para a lista que forma o numero. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo do mês"
          hint={hasPending ? `Com o que falta receber e pagar no mês: ${formatCents(projected)}` : undefined}
          icon={<Wallet />}
          iconTone={isPositive ? "success" : "danger"}
          valueTone={isPositive ? "neutral" : "danger"}
          value={formatCents(summary.resultCents)}
          sub={
            !isPositive
              ? "Saiu mais do que entrou"
              : marginPct !== null
                ? `Sobrou ${marginPct}% do que entrou`
                : "Sobrou após pagamentos"
          }
          action={{ label: "Ver lançamentos", href: financeHref("lancamentos", competence) }}
        />
        <StatCard
          label="Entrou"
          hint="Pagamentos recebidos neste mês, de qualquer mês de referência"
          icon={<ArrowDownRight />}
          iconTone="success"
          value={formatCents(summary.incomePaidCents)}
          sub={summary.incomeForecastCents > 0 ? `+ ${formatCents(summary.incomeForecastCents)} a receber` : "Tudo recebido"}
          action={{ label: "Ver entradas", href: financeHref("lancamentos", competence, { type: "income" }) }}
        />
        <StatCard
          label="Saiu"
          hint="Contas pagas neste mês, de qualquer mês de referência"
          icon={<ArrowUpRight />}
          iconTone="danger"
          value={
            (summary.onlineFeesPaidCents ?? 0) > 0 ? (
              <ExpensesPopover totalCents={summary.expensePaidCents} onlineFeesCents={summary.onlineFeesPaidCents!} />
            ) : (
              formatCents(summary.expensePaidCents)
            )
          }
          sub={summary.expenseForecastCents > 0 ? `+ ${formatCents(summary.expenseForecastCents)} a pagar` : "Contas em dia"}
          action={{ label: "Ver saídas", href: financeHref("lancamentos", competence, { type: "expense" }) }}
        />
        <StatCard
          label="Em atraso"
          icon={<AlertCircle />}
          iconTone={hasOverdue ? "danger" : "neutral"}
          valueTone={overdueCents > 0 ? "danger" : "neutral"}
          value={formatCents(overdueCents)}
          sub={
            earlierCents > 0 ? (
              <Link href={earlierHref} className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                + {formatCents(earlierCents)} de meses anteriores
              </Link>
            ) : overdueCents > 0
                ? "Só deste mês"
                : "Nenhum aluno em atraso"
          }
          action={
            hasOverdue
              ? { label: "Cobrar atrasados", href: overdueHref }
              : { label: "Ver cobranças", href: billingHref(competence) }
          }
        />
      </div>

      {/* Contas a pagar vem antes do grafico no celular (e o que pede acao);
          no computador o grafico fica a esquerda. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PayablesPanel competence={competence} items={upcoming ?? []} />
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-xs lg:order-first lg:col-span-7">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Fluxo de caixa dos últimos 6 meses</h3>
            <p className="text-xs text-muted-foreground">Entradas, saídas e resultado mês a mês</p>
          </div>
          <FinanceCashFlowChart points={series ?? []} />
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Receitas e custos por categoria</h3>
          <p className="text-xs text-muted-foreground">Clique numa categoria para abrir seus lançamentos</p>
        </div>
        <ModernCategoryBreakdown
          categories={categories ?? []}
          competence={competence}
          scholarshipCents={summary.scholarshipGrantedCents ?? 0}
        />
      </div>
    </div>
  );
}

/** Contas atrasadas e as que vencem em 7 dias, as primeiras; o resto em Lancamentos. */
function PayablesPanel({ competence, items }: { competence: string; items: FinanceUpcomingItem[] }) {
  const team = useTeamWords();
  const shown = items.slice(0, PAYABLES_SHOWN);
  const hidden = items.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-xs lg:col-span-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Contas a pagar</h3>
          <p className="text-xs text-muted-foreground">{payablesSubtitle(todayISO())}</p>
        </div>
        <Clock className="size-4 shrink-0 text-muted-foreground" />
      </div>

      {shown.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          Nenhuma conta vencendo em 7 dias.
        </p>
      ) : (
        <div className="divide-y divide-border/40">
          {shown.map((item) => {
            const [day, month] = shortDate(item.dueDate).split("/");
            return (
              <div key={`${item.source}:${item.id}`} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 flex-col items-center justify-center rounded-lg border text-center font-bold",
                      item.overdue ? "border-overdue/30 bg-overdue/10 text-overdue" : "border-border/60 bg-muted/40 text-foreground",
                    )}
                  >
                    <span className="text-xs leading-none">{day}</span>
                    <span className="mt-0.5 text-[9px] uppercase leading-none text-muted-foreground">{month}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="min-w-0 break-words font-medium text-foreground">{item.description}</p>
                    <p className={cn("text-[11px]", item.overdue ? "text-overdue" : "text-muted-foreground")}>
                      {item.overdue ? "Atrasada" : item.source === "teacher_payout" ? team.title : "Conta"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatCents(item.amountCents)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link
          href={financeHref("lancamentos", competence, { type: "expense" })}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {hidden > 0 ? `Ver mais ${plural(hidden, "conta", "contas")}` : "Ver todas as saídas"} <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ===========================================================================
// COMPONENTES AUXILIARES COMPARTILHADOS
// ===========================================================================

function ModernCategoryBreakdown({
  categories,
  competence,
  scholarshipCents = 0,
}: {
  categories: FinanceCategoryTotal[];
  competence?: string;
  /** Bolsas do mes: linha informativa nas entradas, nao entra no caixa. */
  scholarshipCents?: number;
}) {
  const buildCategoryHref = (item: FinanceCategoryTotal) => {
    if (!competence) return "#";
    const isTeacher =
      item.categoryId === "teacher_payout" ||
      item.categoryName.toLowerCase().includes("professor");
    if (isTeacher) {
      return `/finance?tab=professores&month=${competence}`;
    }
    return `/finance?tab=lancamentos&month=${competence}&categoryId=${item.categoryId}&type=${item.type}`;
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <CategoryColumn
        title="Entradas"
        emptyText="Sem entradas pagas no período."
        tone="income"
        items={categories.filter((c) => c.type === "income")}
        hrefOf={buildCategoryHref}
        footer={
          scholarshipCents > 0 ? (
            <p className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span title="Não entram no caixa">Bolsas concedidas</span>
              <span className="shrink-0 tabular-nums">{formatCents(scholarshipCents)}</span>
            </p>
          ) : null
        }
      />
      <CategoryColumn
        title="Saídas e custos"
        emptyText="Sem despesas pagas no período."
        tone="expense"
        items={categories.filter((c) => c.type === "expense")}
        hrefOf={buildCategoryHref}
      />
    </div>
  );
}

const CATEGORY_TONE = {
  income: {
    title: "text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500 group-hover:bg-emerald-400",
  },
  expense: {
    title: "text-rose-700 dark:text-rose-400",
    bar: "bg-rose-500 group-hover:bg-rose-400",
  },
} as const;

/**
 * Uma coluna (entradas ou saidas). Com uma categoria so, o total e a
 * porcentagem repetiriam o valor da linha: aparecem so com 2 ou mais.
 */
function CategoryColumn({
  title,
  emptyText,
  tone,
  items,
  hrefOf,
  footer,
}: {
  title: string;
  emptyText: string;
  tone: keyof typeof CATEGORY_TONE;
  items: FinanceCategoryTotal[];
  hrefOf: (item: FinanceCategoryTotal) => string;
  footer?: ReactNode;
}) {
  const styles = CATEGORY_TONE[tone];
  const showShare = items.length > 1;
  const totalCents = items.reduce((acc, c) => acc + c.totalCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", styles.title)}>
          {title}
        </span>
        {showShare ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatCents(totalCents)}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <Link
              key={item.categoryId}
              href={hrefOf(item)}
              className="group -mx-2 block rounded-xl p-2 transition-all hover:bg-muted/60"
            >
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground transition-colors group-hover:text-primary">
                  <span className="break-words">{item.categoryName}</span>
                  <ArrowUpRight className="size-3 shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatCents(item.totalCents)}
                  {showShare ? (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      ({item.percent}%)
                    </span>
                  ) : null}
                </span>
              </div>
              {showShare ? (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", styles.bar)}
                    style={{ width: `${Math.max(3, item.percent)}%` }}
                  />
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
      {footer}
    </div>
  );
}

// ===========================================================================
// ABA PRINCIPAL DO FINANCEIRO
// ===========================================================================

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

  if (monthIsEmpty && seriesIsEmpty && !upcoming.isPending && (upcoming.data?.length ?? 0) === 0) {
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

  if (summary.isLoading || !s) return <SummarySkeleton />;

  return (
    <SummaryContent
      competence={competence}
      summary={s}
      series={series.data}
      categories={byCategory.data}
      upcoming={upcoming.data}
    />
  );
}

/**
 * "Saiu" com taxa de pagamento online no mes (01/11/2026, decidido com o dono):
 * o valor abre um popover com o que foi taxa e o resto numa linha so; o
 * detalhe das demais saidas fica em Lancamentos. Sem taxa, o numero e liso.
 */
function ExpensesPopover({ totalCents, onlineFeesCents }: { totalCents: number; onlineFeesCents: number }) {
  const otherCents = Math.max(0, totalCents - onlineFeesCents);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 hover:decoration-foreground"
          aria-label="Ver o que saiu em taxas"
        >
          {formatCents(totalCents)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2.5 text-xs">
        <p className="text-sm font-medium text-foreground">O que saiu no mês</p>
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">
              Taxas de pagamento online
              <span className="block text-[11px]">Parceiro e GestaraHub, nos Pix e links pagos.</span>
            </span>
            <span className="shrink-0 font-medium text-foreground">{formatCents(onlineFeesCents)}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Demais saídas</span>
            <span className="shrink-0 font-medium text-foreground">{formatCents(otherCents)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5 font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCents(totalCents)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
