"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Award, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import type { PlanPeriod, StudentEnrollmentState, StudentSummaryMembership } from "@gestarahub/contracts";

/** "2026-09-01" ou ISO completo -> "01/09/2026". */
export const brDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

export const PERIOD_SHORT: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

export const TIMING_LABEL = { prepaid: "Antecipado", postpaid: "Depois do uso" } as const;

const CHIP = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/**
 * Selo da mensalidade no topo da ficha: plano e valor, bolsa ou "Sem
 * mensalidade" (so quando nao ha pacote nem curso para mostrar no lugar).
 */
export function MembershipChip({
  membership,
  showEmpty,
}: {
  membership: StudentSummaryMembership;
  showEmpty: boolean;
}) {
  const paused = membership.status === "paused";
  const period = PERIOD_SHORT[membership.planPeriod ?? "monthly"];
  const { scholarship } = membership;
  if (scholarship) {
    return (
      <span className={cn(CHIP, "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300")}>
        <Award className="size-3 shrink-0 opacity-75" />
        {scholarship.full || membership.priceCents === undefined ? (
          <span>Bolsista integral</span>
        ) : (
          <span className="tabular-nums">
            Bolsa {scholarship.percent}% · {formatCents(membership.priceCents)}/{period}
          </span>
        )}
        {paused ? <PausedTag /> : null}
      </span>
    );
  }
  if (!membership.planId || membership.priceCents === undefined) {
    if (!showEmpty) return null;
    return (
      <span className={cn(CHIP, "border-dashed border-border text-muted-foreground")}>Sem mensalidade</span>
    );
  }
  return (
    <span
      className={cn(
        CHIP,
        paused
          ? "border-border bg-muted text-muted-foreground"
          : "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      )}
    >
      <Wallet className="size-3 shrink-0 opacity-75" />
      <span>{membership.planName}</span>
      <span className="opacity-50">·</span>
      <span className="font-semibold tabular-nums">
        {formatCents(membership.priceCents)}/{period}
      </span>
      {paused ? <PausedTag /> : null}
    </span>
  );
}

function PausedTag() {
  return (
    <span className="rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
      Trancado
    </span>
  );
}

const STATE_META: Record<StudentEnrollmentState, { label: string; className: string }> = {
  active: { label: "Ativa", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  paused: { label: "Trancada", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  completed: { label: "Concluído", className: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  canceled: { label: "Cancelada", className: "border-border/60 bg-muted/50 text-muted-foreground" },
};

export function EnrollmentStateBadge({ state }: { state: StudentEnrollmentState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        STATE_META[state].className,
      )}
    >
      {STATE_META[state].label}
    </span>
  );
}

/** Card de resumo do topo (padrao de KPI: valor nunca truncado). */
export function KpiCard({
  label,
  icon,
  children,
  sub,
  tone = "default",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-4 shadow-2xs",
        tone === "danger" ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/10" : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            tone === "danger" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2">
        {children}
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}
