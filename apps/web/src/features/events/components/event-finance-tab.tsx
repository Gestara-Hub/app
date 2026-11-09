"use client";

import { useState } from "react";
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Plus, Receipt, Wallet } from "lucide-react";
import type { EventView, FinancialEntry } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/labels";
import { useCan } from "@/features/auth";
import { FinanceEntryFormDialog } from "@/features/finance";
import { ChargeAmount, ChargeStatusBadge, installmentLabel, shortDate, useChargeActions } from "@/features/turmas";
import { useEventFinance } from "../hooks/use-events";

/**
 * Aba Financeiro do evento (doc product/29 §Financeiro do evento): o que
 * entrou e falta entrar das inscricoes, as saidas ligadas ao evento e o
 * resultado. Tudo continua no Financeiro geral; aqui e o recorte.
 */

function Card({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    neutral: "border-border/60 bg-card",
    positive: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background to-background",
    negative: "border-destructive/25 bg-gradient-to-br from-destructive/10 via-background to-background",
    warning: "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-background to-background",
  }[tone];
  const iconClass = {
    neutral: "bg-muted text-muted-foreground",
    positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    negative: "bg-destructive/15 text-destructive",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  }[tone];
  return (
    <div className={cn("flex min-w-0 flex-col justify-between rounded-2xl border p-5 shadow-xs", toneClass)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn("flex size-8 items-center justify-center rounded-xl", iconClass)}>{icon}</div>
      </div>
      <div className="mt-3">
        <div className="min-w-0 break-words text-2xl font-extrabold tracking-tight tabular-nums text-foreground">{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}

function entryStatus(e: FinancialEntry, today: string): { label: string; tone: string } {
  if (e.status === "canceled") return { label: "Cancelado", tone: "text-muted-foreground" };
  if (e.status === "paid") return { label: `pago${e.method ? ` via ${paymentMethodLabel(e.method)}` : ""}`, tone: "text-emerald-700 dark:text-emerald-400" };
  if (e.dueDate < today) return { label: `venceu ${shortDate(e.dueDate)}`, tone: "text-red-600 dark:text-red-400" };
  return { label: `vence ${shortDate(e.dueDate)}`, tone: "text-muted-foreground" };
}

export function EventFinanceTab({ event }: { event: EventView }) {
  const can = useCan();
  const canManageFinance = can("finance:manage");
  const { data, isPending, isError } = useEventFinance(event.id);
  const actions = useChargeActions();
  const [entryOpen, setEntryOpen] = useState(false);
  const today = todayISO();

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar o financeiro do evento.</p>
      </div>
    );
  }
  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const paidCount = data.charges.filter((c) => c.status === "paid").length;
  const openCount = data.charges.filter((c) => c.status === "pending" || c.status === "overdue").length;

  return (
    <div className="space-y-6">
      {actions.dialogs}
      <FinanceEntryFormDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        defaultType="expense"
        competence={today.slice(0, 7)}
        eventId={event.id}
        eventName={event.name}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Arrecadado"
          value={formatCents(data.receivedCents)}
          sub={paidCount > 0 ? plural(paidCount, "parcela paga", "parcelas pagas") : "Nenhuma parcela paga"}
          icon={<ArrowUpCircle className="size-4" />}
          tone="positive"
        />
        <Card
          label="A receber"
          value={formatCents(data.openCents)}
          sub={data.overdueCents > 0 ? `${formatCents(data.overdueCents)} já venceu` : openCount > 0 ? plural(openCount, "parcela em aberto", "parcelas em aberto") : "Nada em aberto"}
          icon={<Wallet className="size-4" />}
          tone={data.overdueCents > 0 ? "warning" : "neutral"}
        />
        <Card
          label="Saídas"
          value={formatCents(data.expensesCents)}
          sub={data.otherIncomeCents > 0 ? `+ ${formatCents(data.otherIncomeCents)} de outras entradas` : "Cachê, passagem, material"}
          icon={<ArrowDownCircle className="size-4" />}
          tone={data.expensesCents > 0 ? "negative" : "neutral"}
        />
        <Card
          label="Resultado"
          value={formatCents(data.resultCents)}
          sub="Recebido menos saídas pagas"
          icon={<Receipt className="size-4" />}
          tone={data.resultCents >= 0 ? "positive" : "negative"}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Cobranças das inscrições</h2>
        <ListContainer
          emptyState={
            data.charges.length > 0 ? undefined : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Wallet className="size-8 stroke-[1.5]" />
                <p className="text-sm font-medium">Nenhuma cobrança ainda.</p>
                <p className="text-xs">As parcelas nascem com as inscrições.</p>
              </div>
            )
          }
        >
          {data.charges.map((c) =>
            actions.withContextMenu(
              c,
              <ListRow key={c.id} actions={actions.renderActions(c, false)}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">{c.studentName}</p>
                  <ChargeStatusBadge charge={c} size="sm" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <ChargeAmount charge={c} className="font-medium tabular-nums text-foreground" />
                  {installmentLabel(c) ? <span>{installmentLabel(c)}</span> : null}
                  <span>{c.status === "paid" && c.paidAt ? `pago em ${shortDate(c.paidAt)}` : `vence ${shortDate(c.dueDate)}`}</span>
                </div>
              </ListRow>,
            ),
          )}
        </ListContainer>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Lançamentos do evento</h2>
          {canManageFinance ? (
            <Button variant="outline" onClick={() => setEntryOpen(true)}>
              <Plus className="size-4" />
              Nova saída
            </Button>
          ) : null}
        </div>
        <ListContainer
          emptyState={
            data.entries.length > 0 ? undefined : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Receipt className="size-8 stroke-[1.5]" />
                <p className="text-sm font-medium">Nenhum lançamento ligado ao evento.</p>
                <p className="text-xs">Cachê do convidado, passagem, hospedagem ou material entram aqui e no Financeiro geral.</p>
              </div>
            )
          }
        >
          {data.entries.map((e) => {
            const status = entryStatus(e, today);
            return (
              <ListRow key={e.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("min-w-0 break-words text-sm font-medium", e.status === "canceled" ? "text-muted-foreground line-through" : "text-foreground")}>
                    {e.description}
                  </p>
                  <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium", e.type === "expense" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
                    {e.type === "expense" ? "Saída" : "Entrada"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium tabular-nums text-foreground">{formatCents(e.amountCents)}</span>
                  <span className={status.tone}>{status.label}</span>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
        <p className="text-xs text-muted-foreground">Editar, pagar ou cancelar um lançamento: no Financeiro geral.</p>
      </section>
    </div>
  );
}
