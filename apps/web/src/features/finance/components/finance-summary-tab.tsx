"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Percent,
  RotateCw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import type {
  FinanceCategoryTotal,
  FinanceMonthPoint,
  FinanceSummary,
  FinanceUpcomingItem,
} from "@gestarahub/contracts";
import { addCompetence } from "@gestarahub/core/finance";
import { formatCents, plural } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Badge } from "@/components/ui/badge";
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
import { competenceLabel, financeHref } from "../lib";
import { billingHref, shortDate } from "../finance-ui";
import { FinanceCashFlowChart } from "./finance-cash-flow-chart";

const SERIES_MONTHS = 6;
const UPCOMING_DAYS = 7;
const VIEW_MODE_STORAGE_KEY = "gestarahub:finance:summary_view_mode";

export type SummaryViewMode = "simple" | "advanced";

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

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
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
// VISÃO SIMPLIFICADA (Essencial, Limpa e Direta - Zero Poluição)
// ===========================================================================
function VariantSimplified({
  competence,
  summary,
  upcoming,
  onCreateEntry,
}: {
  competence: string;
  summary: FinanceSummary;
  upcoming?: FinanceUpcomingItem[];
  onCreateEntry?: () => void;
}) {
  const isPositive = summary.resultCents >= 0;
  const hasOverdue = summary.incomeOverdueCents > 0;

  // Cálculo amigável do equilíbrio financeiro do mês
  const totalIn = summary.incomePaidCents;
  const spent = summary.expensePaidCents;
  const saved = Math.max(0, summary.resultCents);
  const savedPct = totalIn > 0 ? Math.min(100, Math.round((saved / totalIn) * 100)) : 0;
  const spentPct = totalIn > 0 ? Math.min(100, Math.round((spent / totalIn) * 100)) : 0;

  const nextPayments = (upcoming ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* 4 Cards Principais e Espaçados */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Saldo do Mês */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all",
            isPositive
              ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background to-background"
              : "border-destructive/25 bg-gradient-to-br from-destructive/10 via-background to-background",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo do Mês
            </span>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-xl",
                isPositive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-4xl">
              {formatCents(summary.resultCents)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPositive
                ? "Sobrou no caixa após pagamentos"
                : "Gastos superaram as receitas no período"}
            </p>
          </div>
        </div>

        {/* Card 2: Total Entrou */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Entrou
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-4xl">
              {formatCents(summary.incomePaidCents)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.incomeForecastCents > 0
                ? `+ ${formatCents(summary.incomeForecastCents)} a receber no mês`
                : "Todas as mensalidades recebidas"}
            </p>
          </div>
        </div>

        {/* Card 3: Total Saiu */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Saiu
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-4xl">
              {formatCents(summary.expensePaidCents)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.expenseForecastCents > 0
                ? `+ ${formatCents(summary.expenseForecastCents)} a pagar até o fim do mês`
                : "Todas as contas pagas em dia"}
            </p>
          </div>
        </div>

        {/* Card 4: Mensalidades em Atraso */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all",
            hasOverdue
              ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/15"
              : "border-border/60 bg-card",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Em Atraso
            </span>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-xl",
                hasOverdue
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <AlertCircle className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={cn(
                "text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl",
                hasOverdue ? "text-amber-600 dark:text-amber-400" : "text-foreground",
              )}
            >
              {formatCents(summary.incomeOverdueCents)}
            </div>
            <div className="mt-1">
              {hasOverdue ? (
                <Link
                  href={billingHref(competence, { status: "overdue" })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Cobrar alunos atrasados <ChevronRight className="size-3" />
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum aluno inadimplente 🎉</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Termômetro do Dinheiro + Próximos Pagamentos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Termômetro do Mês (Para onde foi o dinheiro?) */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-6 shadow-xs lg:col-span-7">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Equilíbrio Financeiro do Mês</h3>
                <p className="text-xs text-muted-foreground">
                  Proporção direta entre o que foi arrecadado e o que sobrou
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                {competence}
              </Badge>
            </div>

            {totalIn > 0 ? (
              <div className="space-y-4">
                {/* Barra Visual Direta */}
                <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${savedPct}%` }}
                    title={`Sobrou no Caixa: ${savedPct}%`}
                  />
                  <div
                    className="h-full bg-rose-400 transition-all"
                    style={{ width: `${spentPct}%` }}
                    title={`Custos e Despesas: ${spentPct}%`}
                  />
                </div>

                {/* Legenda Clara com Valores */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <div className="size-2.5 rounded-full bg-emerald-500" />
                      Sobrou no Caixa ({savedPct}%)
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {formatCents(summary.resultCents)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <div className="size-2.5 rounded-full bg-rose-400" />
                      Custos Pagos ({spentPct}%)
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {formatCents(summary.expensePaidCents)}
                    </div>
                  </div>
                </div>

                {/* Frase Humana de Insight */}
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/40">
                  💡 <strong className="text-foreground">Resumo prático:</strong> A cada R$ 100 arrecadados neste mês,{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">R$ {savedPct}</strong> ficaram livres de lucro no caixa do seu negócio.
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Ainda não há entradas registradas nesta competência para calcular o equilíbrio.
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-border/40 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Quer ver o gráfico mês a mês completo e análise por categoria?</span>
            <span className="text-primary font-medium">Alterne para a Visão Avançada acima</span>
          </div>
        </div>

        {/* Próximas Contas a Pagar Imediatas */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-6 shadow-xs lg:col-span-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Próximos Pagamentos</h3>
                <p className="text-xs text-muted-foreground">Contas e professores nos próximos 7 dias</p>
              </div>
              <Clock className="size-4 text-muted-foreground" />
            </div>

            {nextPayments.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                Nenhum pagamento pendente para os próximos 7 dias. Tudo em dia!
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {nextPayments.map((item) => (
                  <div key={`${item.source}:${item.id}`} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={cn(
                          "flex size-9 flex-col items-center justify-center rounded-lg border text-center font-bold shrink-0",
                          item.overdue
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-border/60 bg-muted/40 text-foreground",
                        )}
                      >
                        <span className="text-xs leading-none">{shortDate(item.dueDate).split("/")[0]}</span>
                        <span className="text-[9px] uppercase leading-none text-muted-foreground mt-0.5">
                          {shortDate(item.dueDate).split("/")[1]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{item.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.source === "teacher_payout" ? "Professor" : "Conta operacional"}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold tabular-nums text-foreground shrink-0 text-sm">
                      {formatCents(item.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-border/40 pt-4 text-center">
            <Link
              href={financeHref("lancamentos", competence, { type: "expense" })}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todas as despesas e contas <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos para o Dia a Dia */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <span className="text-xs font-medium text-foreground">Ações rápidas do dia a dia:</span>
        <div className="flex flex-wrap items-center gap-2">
          {onCreateEntry ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              onClick={onCreateEntry}
            >
              Registrar Lançamento
            </Button>
          ) : (
            <Link href={financeHref("lancamentos", competence)}>
              <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer">
                Registrar Lançamento
              </Button>
            </Link>
          )}
          <Link href={billingHref(competence)}>
            <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer">
              Gerenciar Cobranças
            </Button>
          </Link>
          <Link href={financeHref("professores", competence)}>
            <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer">
              Folha dos Professores
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// VISÃO AVANÇADA: HERO EXECUTIVO (Hierarquia de Resultado & Linha do Tempo)
// ===========================================================================
function VariantExecutive({
  competence,
  summary,
  series,
  categories,
  upcoming,
  previous,
}: {
  competence: string;
  summary: FinanceSummary;
  series?: FinanceMonthPoint[];
  categories?: FinanceCategoryTotal[];
  upcoming?: FinanceUpcomingItem[];
  previous?: FinanceMonthPoint;
}) {
  const isPositive = summary.resultCents >= 0;
  const projected = summary.resultCents + summary.incomeForecastCents - summary.expenseForecastCents;
  const hasPending = summary.incomeForecastCents > 0 || summary.expenseForecastCents > 0;
  const hasOverdue = summary.incomeOverdueCents > 0 || summary.expenseOverdueCents > 0;

  const incomePct =
    previous?.incomeCents && previous.incomeCents > 0
      ? Math.round(((summary.incomePaidCents - previous.incomeCents) / previous.incomeCents) * 100)
      : null;

  const marginPct =
    summary.incomePaidCents > 0
      ? Math.round((summary.resultCents / summary.incomePaidCents) * 100)
      : null;

  // Proporção de recebido vs inadimplente no faturamento do mês
  const totalBilledCents = summary.incomePaidCents + summary.incomeOverdueCents;
  const paidRatio =
    totalBilledCents > 0
      ? Math.min(100, Math.max(0, Math.round((summary.incomePaidCents / totalBilledCents) * 100)))
      : 100;
  const overdueRatio = 100 - paidRatio;

  return (
    <div className="space-y-5">
      {/* Grid Principal: Hero de Resultado + 3 Métricas */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Bloco Nobre: Resultado Líquido */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-xs transition-all lg:col-span-5",
            isPositive
              ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background to-background dark:from-emerald-950/25"
              : "border-destructive/25 bg-gradient-to-br from-destructive/10 via-background to-background dark:from-destructive-950/25",
          )}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lucro Líquido
                </span>
                {marginPct !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold border",
                      marginPct >= 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-destructive/30 bg-destructive/10 text-destructive",
                    )}
                    title="Margem Operacional = Resultado Líquido ÷ Entradas Pagas"
                  >
                    <Percent className="size-2.5" />
                    {marginPct >= 0 ? `+${marginPct}%` : `${marginPct}%`} margem
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {isPositive ? "Superávit" : "Déficit"}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl text-foreground">
                {formatCents(summary.resultCents)}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  Entrou <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCents(summary.incomePaidCents)}</strong>
                </span>
                <span>(−)</span>
                <span>
                  Saiu <strong className="text-rose-600 dark:text-rose-400 font-semibold">{formatCents(summary.expensePaidCents)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Previsão com Abertos do Mês */}
          {hasPending ? (
            <div className="mt-4 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xs p-3 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Previsão com abertos do mês:</span>
                <span className={cn("font-bold tabular-nums text-sm", projected < 0 ? "text-destructive" : "text-foreground")}>
                  {formatCents(projected)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                {summary.incomeForecastCents > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatCents(summary.incomeForecastCents)} a receber
                  </span>
                )}
                {summary.incomeForecastCents > 0 && summary.expenseForecastCents > 0 && (
                  <span className="text-muted-foreground/40">•</span>
                )}
                {summary.expenseForecastCents > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                    −{formatCents(summary.expenseForecastCents)} a pagar
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              <span>Sem cobranças ou contas pendentes em aberto para este mês.</span>
            </div>
          )}
        </div>

        {/* 3 Cartões Laterais de Apoio */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-7">
          {/* Entradas */}
          <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 shadow-2xs transition-all hover:border-emerald-500/30">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Entradas Pagas</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownRight className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {formatCents(summary.incomePaidCents)}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {incomePct !== null ? (
                    <span className={cn("font-medium", incomePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {incomePct >= 0 ? `+${incomePct}%` : `${incomePct}%`}{" "}
                      <span className="text-muted-foreground font-normal">vs anterior</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Mensalidades e avulsas</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-border/40 pt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>A receber:</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {summary.incomeForecastCents > 0 ? formatCents(summary.incomeForecastCents) : "R$ 0,00"}
                </span>
              </div>
              <Link
                href={financeHref("lancamentos", competence, { type: "income" })}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline pt-0.5"
              >
                Ver entradas <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Saídas */}
          <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 shadow-2xs transition-all hover:border-rose-500/30">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Saídas Pagas</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <ArrowUpRight className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {formatCents(summary.expensePaidCents)}
                </span>
                <div className="mt-1 text-xs text-muted-foreground">
                  Despesas e professores
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-border/40 pt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>A vencer:</span>
                <span className={cn("font-semibold tabular-nums", summary.expenseForecastCents > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                  {summary.expenseForecastCents > 0 ? formatCents(summary.expenseForecastCents) : "R$ 0,00"}
                </span>
              </div>
              <Link
                href={financeHref("lancamentos", competence, { type: "expense" })}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline pt-0.5"
              >
                Ver saídas <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Inadimplência / Atrasos */}
          <div
            className={cn(
              "flex flex-col justify-between rounded-2xl border p-4 shadow-2xs transition-all",
              hasOverdue
                ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10"
                : "border-border/60 bg-card hover:border-amber-500/30",
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Inadimplência</span>
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    hasOverdue ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground",
                  )}
                >
                  <AlertCircle className="size-4" />
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {formatCents(summary.incomeOverdueCents)}
                  </span>
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    {overdueRatio}% em atraso
                  </span>
                </div>

                {/* Barra de progresso visual: Recebido vs Atrasado */}
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${paidRatio}%` }}
                      title={`Recebido: ${paidRatio}%`}
                    />
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${overdueRatio}%` }}
                      title={`Atrasado: ${overdueRatio}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{paidRatio}% recebido</span>
                    {summary.expenseOverdueCents > 0 && (
                      <span className="text-destructive font-medium">Contas: {formatCents(summary.expenseOverdueCents)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-border/40 pt-2">
              <Link href={billingHref(competence, { status: "overdue" })} className="block">
                <Button
                  size="sm"
                  variant={summary.incomeOverdueCents > 0 ? "default" : "outline"}
                  className={cn(
                    "w-full h-7 text-xs font-medium gap-1 cursor-pointer",
                    summary.incomeOverdueCents > 0
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                      : "text-muted-foreground",
                  )}
                >
                  Cobrar alunos atrasados
                  <ChevronRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Secundária: Gráfico Amplo + Categorias com visual moderno */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Gráfico */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Fluxo de Caixa Semestral</h3>
              <p className="text-xs text-muted-foreground">Comparativo de entradas, saídas e resultado mês a mês</p>
            </div>
            <Badge variant="outline" className="text-[11px]">
              6 Meses
            </Badge>
          </div>
          <FinanceCashFlowChart points={series ?? []} />
        </div>

        {/* Categorias com visual de Barras Proporcionais */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Destino das Receitas e Custos</h3>
                <p className="text-xs text-muted-foreground">Clique numa categoria para abrir seus lançamentos</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {categories?.length ?? 0} {plural(categories?.length ?? 0, "categoria", "categorias")}
              </Badge>
            </div>
            <ModernCategoryBreakdown categories={categories ?? []} competence={competence} />
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground">
            Categorias automáticas de mensalidades e professores integradas.
          </div>
        </div>
      </div>

      {/* Próximos Vencimentos em Lista Compacta com Ação Rápida */}
      <UpcomingCompactList items={upcoming ?? []} />
    </div>
  );
}

// ===========================================================================
// COMPONENTES AUXILIARES COMPARTILHADOS
// ===========================================================================

function ModernCategoryBreakdown({
  categories,
  competence,
}: {
  categories: FinanceCategoryTotal[];
  competence?: string;
}) {
  const incomes = categories.filter((c) => c.type === "income");
  const expenses = categories.filter((c) => c.type === "expense");

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
      {/* Entradas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Entradas
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatCents(incomes.reduce((acc, c) => acc + c.totalCents, 0))}
          </span>
        </div>
        {incomes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem entradas pagas no período.</p>
        ) : (
          <div className="space-y-1.5">
            {incomes.map((item) => (
              <Link
                key={item.categoryId}
                href={buildCategoryHref(item)}
                className="group -mx-2 block rounded-xl p-2 transition-all hover:bg-muted/60"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    <span className="truncate">{item.categoryName}</span>
                    <ArrowUpRight className="size-3 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </span>
                  <span className="ml-2 shrink-0 font-semibold tabular-nums text-foreground">
                    {formatCents(item.totalCents)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">({item.percent}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all group-hover:bg-emerald-400"
                    style={{ width: `${Math.max(3, item.percent)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Saídas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Saídas & Custos
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatCents(expenses.reduce((acc, c) => acc + c.totalCents, 0))}
          </span>
        </div>
        {expenses.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem despesas pagas no período.</p>
        ) : (
          <div className="space-y-1.5">
            {expenses.map((item) => (
              <Link
                key={item.categoryId}
                href={buildCategoryHref(item)}
                className="group -mx-2 block rounded-xl p-2 transition-all hover:bg-muted/60"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    <span className="truncate">{item.categoryName}</span>
                    <ArrowUpRight className="size-3 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </span>
                  <span className="ml-2 shrink-0 font-semibold tabular-nums text-foreground">
                    {formatCents(item.totalCents)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">({item.percent}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all group-hover:bg-rose-400"
                    style={{ width: `${Math.max(3, item.percent)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type UpcomingFilter = "all" | "expenses" | "teachers";

function UpcomingCompactList({ items }: { items: FinanceUpcomingItem[] }) {
  const [filter, setFilter] = useState<UpcomingFilter>("all");

  const expenseCount = items.filter((i) => i.source === "entry").length;
  const teacherCount = items.filter((i) => i.source === "teacher_payout").length;

  const filteredItems = items.filter((item) => {
    if (filter === "expenses") return item.source === "entry";
    if (filter === "teachers") return item.source === "teacher_payout";
    return true;
  });

  if (items.length === 0) return null;

  const today = todayISO();

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Compromissos Financeiros Próximos (7 dias)</h3>
          <Badge variant="outline" className="text-[11px] font-normal">
            {items.length} {plural(items.length, "vencimento", "vencimentos")}
          </Badge>
        </div>

        {/* Filtros Rápidos */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "all" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Todos ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("expenses")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "expenses" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Contas ({expenseCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("teachers")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "teachers" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Professores ({teacherCount})
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nenhum compromisso encontrado para este filtro.
        </p>
      ) : (
        <div className="divide-y divide-border/40">
          {filteredItems.map((item) => {
            const isToday = item.dueDate === today;
            const monthComp = item.dueDate.slice(0, 7);
            const actionHref =
              item.source === "teacher_payout"
                ? `/finance?tab=professores&month=${monthComp}`
                : `/finance?tab=lancamentos&month=${monthComp}&search=${encodeURIComponent(item.description)}`;
            const actionLabel = item.source === "teacher_payout" ? "Ver folha" : "Ver conta";

            return (
              <div
                key={`${item.source}:${item.id}`}
                className="flex flex-col gap-2.5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex size-10 flex-col items-center justify-center rounded-xl border text-center font-bold shrink-0 shadow-2xs",
                      item.overdue
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : isToday
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-border/60 bg-muted/30 text-foreground",
                    )}
                  >
                    <span className="text-xs leading-none">{shortDate(item.dueDate).split("/")[0]}</span>
                    <span className="text-[9px] uppercase leading-none text-muted-foreground mt-0.5">
                      {shortDate(item.dueDate).split("/")[1]}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{item.description}</p>
                      {item.overdue ? (
                        <span className="inline-flex rounded-full bg-destructive/10 px-1.5 py-0.2 text-[10px] font-semibold text-destructive shrink-0">
                          Atrasado
                        </span>
                      ) : isToday ? (
                        <span className="inline-flex rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          Vence hoje
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.source === "teacher_payout" ? "Pagamento de professor" : "Conta operacional a pagar"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                  <span className="font-bold tabular-nums text-foreground sm:text-right text-sm">
                    {formatCents(item.amountCents)}
                  </span>
                  <Link href={actionHref}>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 cursor-pointer">
                      {actionLabel}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const [viewMode, setViewMode] = useState<SummaryViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === "simple" || saved === "advanced") return saved;
    }
    return "simple";
  });

  const handleSetViewMode = (mode: SummaryViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        // Ignora erro em navegadores restritivos
      }
    }
  };

  const summary = useFinanceSummary(competence);
  const series = useFinanceSeries(SERIES_MONTHS, competence);
  const byCategory = useFinanceByCategory(competence);
  const upcoming = useFinanceUpcoming(UPCOMING_DAYS);
  const { setTab } = useFinanceUrlState();
  const can = useCan();
  const canManage = can("finance:manage");

  const previousCompetence = addCompetence(competence, -1);
  const previous = series.data?.find((p) => p.competence === previousCompetence);

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
    <div className="space-y-5">
      {/* Barra de Seleção de Modo: Simplificada vs Avançada */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Modo de visualização:</span>
          <span>
            {viewMode === "simple"
              ? "Exibindo visão simplificada com foco em saldo e equilíbrio do mês."
              : "Exibindo visão avançada completa com margem, projeções e categorias."}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-background/90 p-0.5 shadow-2xs self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => handleSetViewMode("simple")}
            className={cn(
              "flex items-center gap-1.5 cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-all",
              viewMode === "simple"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutDashboard className="size-3.5" />
            Simplificada
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode("advanced")}
            className={cn(
              "flex items-center gap-1.5 cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-all",
              viewMode === "advanced"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Avançada
          </button>
        </div>
      </div>

      {summary.isLoading || !s ? (
        <SummarySkeleton />
      ) : (
        <>
          {viewMode === "simple" ? (
            <VariantSimplified
              competence={competence}
              summary={s}
              upcoming={upcoming.data}
              onCreateEntry={onCreateEntry}
            />
          ) : (
            <VariantExecutive
              competence={competence}
              summary={s}
              series={series.data}
              categories={byCategory.data}
              upcoming={upcoming.data}
              previous={previous}
            />
          )}
        </>
      )}
    </div>
  );
}
