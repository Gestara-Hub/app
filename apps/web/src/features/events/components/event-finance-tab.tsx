"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, ExternalLink, Plus, Receipt, Wallet } from "lucide-react";
import type { EventView, FinancialEntry } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { InitialsAvatar, ListContainer, ListEmptyState, ListRow, SearchInput } from "@/components/shared/list";
import { ListItemActionsMenu, ListItemContextMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodLabel } from "@/lib/labels";
import { normalizeText, textIncludes } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { FinanceEntryFormDialog, currentCompetence, financeHref } from "@/features/finance";
import {
  ChargeAmount,
  ChargeStatusBadge,
  PaidViaBadge,
  ScholarshipBadge,
  WhatsAppSentBadge,
  cleanSingleSubtitle,
  matchesStatusFilter,
  renderSubtitle,
  shortDate,
  statusLabelOf,
  statusRepeatsTab,
  useChargeActions,
  type StatusFilterValue,
} from "@/features/turmas";
import { useEventFinance, useEventRegistrations } from "../hooks/use-events";
import { useEventGraduation } from "../hooks/use-event-graduation";

/**
 * Aba Financeiro do evento (doc product/29 §Financeiro do evento), com os
 * conceitos das telas de dinheiro (12/11/2026): os cartoes de Cobrancas
 * (StatCard com o link que filtra a lista), as cobrancas das inscricoes como
 * na tela de Cobrancas (abas A receber, Em atraso, Pagas e Todas, iniciais,
 * "venceu 10/11 · 2 dias" em vermelho no lugar do selo, valor a direita) e os
 * lancamentos do evento como no Financeiro (icone, valor com sinal, sem selo
 * chamativo). Tudo continua no Financeiro geral; aqui e o recorte.
 */

/** "vence 10/11", "venceu 10/11 · 2 dias" (vermelho), "pago via Pix" ou "cancelado". */
function entrySubtitle(e: FinancialEntry, today: string): { text: string; overdue?: boolean } {
  if (e.status === "canceled") return { text: "cancelado" };
  if (e.status === "paid") return { text: `pago${e.method ? ` via ${paymentMethodLabel(e.method)}` : ""}` };
  if (e.dueDate < today) {
    const days = Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(e.dueDate)));
    return { text: `venceu ${shortDate(e.dueDate)} · ${plural(days, "dia", "dias")}`, overdue: true };
  }
  return { text: `vence ${shortDate(e.dueDate)}` };
}

export function EventFinanceTab({ event }: { event: EventView }) {
  const router = useRouter();
  const can = useCan();
  const canManageFinance = can("finance:manage");
  const { data, isPending, isError } = useEventFinance(event.id);
  const actions = useChargeActions();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryPreset, setEntryPreset] = useState<{ description: string; amountCents: number } | undefined>();
  // Repasse a federacao (doc product/30 §4): por aluno graduado neste evento.
  const fee = event.graduation ? (event.federationFeeCents ?? 0) : 0;
  const { data: registrations } = useEventRegistrations(event.id);
  const { graduatedCount } = useEventGraduation(event, registrations, fee > 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("open");
  const entriesRef = useRef<HTMLElement>(null);
  const today = todayISO();

  const charges = useMemo(() => data?.charges ?? [], [data]);
  const searched = charges.filter((c) => !search.trim() || textIncludes(c.studentName, search));
  const shown = searched.filter((c) => matchesStatusFilter(c, statusFilter));
  const otherCount = searched.filter((c) => matchesStatusFilter(c, "other")).length;
  const overdueCount = searched.filter((c) => matchesStatusFilter(c, "overdue")).length;
  // As mesmas abas da tela de Cobrancas, com a contagem de cada uma.
  const tabs: { id: StatusFilterValue; label: string; count: number; alert?: boolean }[] = [
    { id: "open", label: "A receber", count: searched.filter((c) => matchesStatusFilter(c, "open")).length },
    { id: "overdue", label: "Em atraso", count: overdueCount, alert: overdueCount > 0 },
    { id: "paid", label: "Pagas", count: searched.filter((c) => matchesStatusFilter(c, "paid")).length },
    ...(otherCount > 0 || statusFilter === "other" ? [{ id: "other" as const, label: "Isentas e encerradas", count: otherCount }] : []),
    { id: "all", label: "Todas", count: searched.length },
  ];
  const hasFilters = statusFilter !== "open" || Boolean(search.trim());
  const clearFilters = () => {
    setStatusFilter("open");
    setSearch("");
  };
  const showCharges = (filter: StatusFilterValue) => {
    setStatusFilter(filter);
    setSearch("");
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar o financeiro do evento.</p>
      </div>
    );
  }

  const REPASSE = "Repasse à federação";
  const repasseExpected = fee * graduatedCount;
  const repasseLaunched = (data?.entries ?? [])
    .filter((e) => e.type === "expense" && e.status !== "canceled" && normalizeText(e.description).startsWith(normalizeText(REPASSE)))
    .reduce((sum, e) => sum + e.amountCents, 0);
  const repasseMissing = repasseExpected - repasseLaunched;
  const openEntry = (preset?: { description: string; amountCents: number }) => {
    setEntryPreset(preset);
    setEntryOpen(true);
  };

  const paidCount = charges.filter((c) => c.status === "paid").length;
  const openCount = charges.filter((c) => c.status === "pending" || c.status === "overdue").length;
  const entries = data?.entries ?? [];

  const chargesEmpty =
    !isPending && shown.length === 0 ? (
      <ListEmptyState
        hasSearch={Boolean(search.trim())}
        hasFilters={statusFilter !== "open"}
        onClearSearch={() => setSearch("")}
        onClearFilters={() => setStatusFilter("open")}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Wallet className="size-7" />}
            title={charges.length === 0 ? "Nenhuma cobrança no evento" : "Nada a receber"}
            description={charges.length === 0 ? "As parcelas nascem com as inscrições." : "Todas as inscrições estão pagas."}
          />
        }
      />
    ) : null;

  const entriesEmpty =
    !isPending && entries.length === 0 ? (
      <ModuleEmptyGuide
        icon={<Receipt className="size-7" />}
        title="Nenhuma saída lançada"
        description="Cachê do convidado, passagem, hospedagem e material entram aqui e no Financeiro geral."
        actionLabel={canManageFinance ? "Nova saída" : undefined}
        onAction={canManageFinance ? () => openEntry() : undefined}
      />
    ) : null;

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
        preset={entryPreset}
      />

      {/* Os cartoes de Cobrancas: cada um com o link que filtra a lista do numero. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recebido"
          icon={<ArrowDownLeft />}
          iconTone="success"
          valueTone={(data?.receivedCents ?? 0) > 0 ? "success" : "neutral"}
          value={formatCents(data?.receivedCents ?? 0)}
          sub={paidCount > 0 ? plural(paidCount, "paga", "pagas") : "Nenhuma paga"}
          action={{ label: "Ver pagas", onClick: () => showCharges("paid") }}
          active={statusFilter === "paid"}
          isLoading={isPending}
        />
        <StatCard
          label="A receber"
          icon={<Wallet />}
          iconTone={(data?.overdueCents ?? 0) > 0 ? "danger" : "neutral"}
          value={formatCents(data?.openCents ?? 0)}
          sub={
            (data?.overdueCents ?? 0) > 0
              ? `${formatCents(data!.overdueCents)} em atraso`
              : openCount > 0
                ? plural(openCount, "em aberto", "em aberto")
                : "Nada em aberto"
          }
          action={{ label: "Ver a receber", onClick: () => showCharges("open") }}
          active={statusFilter === "open"}
          isLoading={isPending}
        />
        <StatCard
          label="Saídas"
          icon={<ArrowUpRight />}
          iconTone="neutral"
          value={formatCents(data?.expensesCents ?? 0)}
          sub={(data?.otherIncomeCents ?? 0) > 0 ? `+ ${formatCents(data!.otherIncomeCents)} de outras entradas` : "Cachê, passagem, material"}
          action={{ label: "Ver saídas", onClick: () => entriesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }}
          isLoading={isPending}
        />
        <StatCard
          label="Resultado"
          icon={<Receipt />}
          iconTone={(data?.resultCents ?? 0) >= 0 ? "success" : "danger"}
          valueTone={(data?.resultCents ?? 0) >= 0 ? "neutral" : "danger"}
          value={formatCents(data?.resultCents ?? 0)}
          sub="Recebido menos saídas pagas"
          action={{ label: "Ver no Financeiro", href: financeHref("resumo", currentCompetence()) }}
          isLoading={isPending}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Cobranças das inscrições</h2>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar aluno..." aria-label="Buscar aluno" />
        {charges.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
              {tabs.map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      active ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                        tab.alert ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{plural(shown.length, "cobrança", "cobranças")}</span>
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className="font-medium text-primary hover:underline">
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ListContainer emptyState={chargesEmpty}>
          {isPending ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : (
            shown.map((c) =>
              actions.withContextMenu(
                c,
                <ListRow
                  key={c.id}
                  data-record-id={c.id}
                  className="flex-wrap gap-y-2 sm:flex-nowrap [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0 [&>div:last-child]:ml-auto"
                  actions={
                    <div className="flex items-center gap-2.5">
                      <ChargeAmount charge={c} className="text-sm font-semibold tabular-nums" />
                      <div className="flex min-h-8 min-w-8 items-center justify-center">{actions.renderActions(c, false)}</div>
                    </div>
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <InitialsAvatar name={c.studentName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/clients/${c.studentId}`}
                          className="min-w-0 break-words text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {c.studentName}
                        </Link>
                        {c.status === "waived" || statusRepeatsTab(statusLabelOf(c), statusFilter) ? null : <ChargeStatusBadge charge={c} />}
                        <PaidViaBadge charge={c} />
                        <ScholarshipBadge charge={c} />
                        <WhatsAppSentBadge charge={c} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{renderSubtitle(cleanSingleSubtitle(c))}</p>
                    </div>
                  </div>
                </ListRow>,
              ),
            )
          )}
        </ListContainer>
      </section>

      <section ref={entriesRef} className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Lançamentos do evento</h2>
          {canManageFinance ? (
            <Button variant="outline" onClick={() => openEntry()}>
              <Plus className="size-4" />
              Nova saída
            </Button>
          ) : null}
        </div>
        {fee > 0 && graduatedCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-foreground">
                {REPASSE}: {plural(graduatedCount, "graduado", "graduados")} × {formatCents(fee)} = {formatCents(repasseExpected)}
              </p>
              <p className="text-xs text-muted-foreground">
                {repasseLaunched === 0
                  ? "Ainda não lançado."
                  : repasseMissing > 0
                    ? `Lançado ${formatCents(repasseLaunched)}; faltam ${formatCents(repasseMissing)}.`
                    : `Lançado ${formatCents(repasseLaunched)}.`}
              </p>
            </div>
            {canManageFinance && repasseMissing > 0 ? (
              <Button variant="outline" onClick={() => openEntry({ description: REPASSE, amountCents: repasseMissing })}>
                {repasseLaunched > 0 ? "Lançar a diferença" : "Lançar repasse"}
              </Button>
            ) : null}
          </div>
        ) : null}
        <ListContainer emptyState={entriesEmpty}>
          {entries.map((e) => {
            const isIncome = e.type === "income";
            const canceled = e.status === "canceled";
            const sub = entrySubtitle(e, today);
            const entryActions: ListItemAction[] = [
              {
                key: "open",
                label: "Abrir no Financeiro",
                icon: <ExternalLink className="size-4" />,
                onSelect: () => router.push(financeHref("lancamentos", e.dueDate.slice(0, 7))),
              },
            ];
            return (
              <ListItemContextMenu key={e.id} actions={entryActions}>
                <ListRow
                  data-record-id={e.id}
                  aria-label={e.description}
                  actions={<ListItemActionsMenu actions={entryActions} title="Ações do lançamento" ariaLabel={`Ações de ${e.description}`} variant="ghost" />}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", isIncome ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}
                      aria-hidden
                    >
                      {isIncome ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-sm font-medium text-foreground", canceled && "text-muted-foreground line-through")}>{e.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isIncome ? "Entrada" : "Saída"} · {sub.overdue ? <span className="text-overdue">{sub.text}</span> : sub.text}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", canceled ? "text-muted-foreground line-through" : "text-foreground")}>
                      {isIncome ? "+" : "−"} {formatCents(e.amountCents)}
                    </span>
                  </div>
                </ListRow>
              </ListItemContextMenu>
            );
          })}
        </ListContainer>
        {entries.length > 0 ? <p className="text-xs text-muted-foreground">Editar, pagar ou cancelar: no Financeiro geral (menu ⋮ da linha).</p> : null}
      </section>
    </div>
  );
}
