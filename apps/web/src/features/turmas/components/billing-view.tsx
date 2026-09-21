"use client";

import { useState, useSyncExternalStore } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
} from "@/components/shared/list";
import { ListItemActionsMenu } from "@/components/shared/list-item-actions-menu";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import type {
  ChargeKind,
  ChargeStatus,
  ChargeView,
} from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useCancelCharge,
  useCharges,
  useClearCharges,
  useGenerateCharges,
  useMarkChargePaid,
  useMarkChargePending,
  useRevertCharge,
} from "../hooks/use-billing";

const STATUS_LABEL: Record<ChargeStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
};

const STATUS_CLASS: Record<ChargeStatus, string> = {
  pending: "border-border/60 bg-muted/50 text-muted-foreground",
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  canceled: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 line-through",
};

interface StudentBillingGroup {
  key: string;
  studentId: string;
  studentName: string;
  kind: ChargeKind;
  className?: string;
  planName?: string;
  isMultiCycle: boolean;
  totalCycles: number;
  periodLabel?: string;
  unitPriceCents: number;
  activeTotalCents: number;
  paidCents: number;
  overdueCents: number;
  canceledCents: number;
  activeCount: number;
  paidCount: number;
  overdueCount: number;
  canceledCount: number;
  charges: ChargeView[];
}

function groupCharges(charges: ChargeView[]): StudentBillingGroup[] {
  const map = new Map<string, StudentBillingGroup>();

  for (const c of charges) {
    const isMembership = c.kind === "membership";
    const key = isMembership ? `${c.studentId}_${c.planId ?? ""}` : c.id;

    if (!map.has(key)) {
      const isMulti = (c.cycleTotal ?? 1) > 1;
      const periodLabel =
        c.cycleTotal === 4
          ? "semana"
          : c.cycleTotal === 2
            ? "quinzena"
            : undefined;

      map.set(key, {
        key,
        studentId: c.studentId,
        studentName: c.studentName,
        kind: c.kind,
        className: c.className,
        planName: c.planName,
        isMultiCycle: isMulti,
        totalCycles: c.cycleTotal ?? 1,
        periodLabel,
        unitPriceCents: c.amountCents,
        activeTotalCents: 0,
        paidCents: 0,
        overdueCents: 0,
        canceledCents: 0,
        activeCount: 0,
        paidCount: 0,
        overdueCount: 0,
        canceledCount: 0,
        charges: [],
      });
    }

    const group = map.get(key)!;
    group.charges.push(c);

    if (group.charges.length > 1) {
      group.isMultiCycle = true;
    }

    if (c.status === "canceled") {
      group.canceledCents += c.amountCents;
      group.canceledCount += 1;
    } else {
      group.activeTotalCents += c.amountCents;
      group.activeCount += 1;

      if (c.status === "paid") {
        group.paidCents += c.amountCents;
        group.paidCount += 1;
      } else if (c.status === "overdue") {
        group.overdueCents += c.amountCents;
        group.overdueCount += 1;
      }
    }
  }

  // Ordena as sub-cobranças por ciclo e vencimento
  for (const group of map.values()) {
    group.charges.sort((a, b) => {
      if (a.cycleIndex !== undefined && b.cycleIndex !== undefined) {
        return a.cycleIndex - b.cycleIndex;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "pt-BR"),
  );
}

function getCycleTitle(c: ChargeView): string {
  if (c.isProrated) {
    return c.proratedDays
      ? `Proporcional (${c.proratedDays} dias)`
      : "Proporcional";
  }
  if (c.cycleTotal === 4) {
    return `Semana ${c.cycleIndex ?? 1}/4`;
  }
  if (c.cycleTotal === 2) {
    return `${c.cycleIndex ?? 1}ª Quinzena`;
  }
  if ((c.cycleTotal ?? 1) > 1) {
    return `Parcela ${c.cycleIndex ?? 1}/${c.cycleTotal}`;
  }
  return "Mensalidade";
}

export function BillingView() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [competence, setCompetence] = useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const [kindFilter, setKindFilter] = useState<"all" | ChargeKind>("all");
  const [chargeToCancel, setChargeToCancel] = useState<ChargeView | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { data: charges, isLoading } = useCharges({
    competence,
    kind: kindFilter === "all" ? undefined : kindFilter,
  });

  const generateMut = useGenerateCharges();
  const paidMut = useMarkChargePaid();
  const pendingMut = useMarkChargePending();
  const cancelMut = useCancelCharge();
  const revertMut = useRevertCharge();
  const clearMut = useClearCharges();

  const can = useCan();
  const canManage = can("billing:manage");

  const list = charges ?? [];
  const groups = groupCharges(list);

  const activeList = list.filter((c) => c.status !== "canceled");
  const activeTotalCents = activeList.reduce((s, c) => s + c.amountCents, 0);

  const paidList = list.filter((c) => c.status === "paid");
  const paidCents = paidList.reduce((s, c) => s + c.amountCents, 0);

  const overdueList = list.filter((c) => c.status === "overdue");
  const overdueCents = overdueList.reduce((s, c) => s + c.amountCents, 0);

  const canceledList = list.filter((c) => c.status === "canceled");
  const canceledCents = canceledList.reduce((s, c) => s + c.amountCents, 0);

  const generate = () =>
    generateMut.mutate(competence, {
      onSuccess: (r) =>
        toast.success(
          r.created > 0
            ? `${r.created} cobrança(s) gerada(s).`
            : "Nenhuma cobrança nova (já geradas).",
        ),
    });

  const handleClear = () => {
    clearMut.mutate(competence, {
      onSuccess: (r) =>
        toast.success(
          r.deleted > 0
            ? `${r.deleted} cobrança(s) removida(s). Você já pode clicar em "Gerar cobranças".`
            : "Nenhuma cobrança para remover nesta competência.",
        ),
    });
  };

  return (
    <>
      <PageHeader
        title="Mensalidades"
        description="Cobranças por competência (mês)."
      >
        {canManage ? (
          <div className="flex items-center gap-2">
            {list.length > 0 ? (
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={clearMut.isPending}
                className="text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                title="Remover cobranças desta competência para testar nova geração"
              >
                <RotateCcw className="size-4" />
                Resetar cobranças
              </Button>
            ) : null}
            <Button
              onClick={generate}
              disabled={generateMut.isPending}
            >
              <Wallet className="size-4" />
              Gerar cobranças
            </Button>
          </div>
        ) : null}
      </PageHeader>

      {!mounted ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Total Ativo */}
            <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Total ativo
                </span>
                <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Wallet className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                    {formatCents(activeTotalCents)}
                  </div>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isLoading ? "—" : `${activeList.length} ativa(s)`}
                </p>
              </div>
            </div>

            {/* Recebido */}
            <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Recebido
                </span>
                <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="text-xl font-bold tabular-nums text-emerald-600 sm:text-2xl dark:text-emerald-400">
                    {formatCents(paidCents)}
                  </div>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isLoading ? "—" : `${paidList.length} paga(s)`}
                </p>
              </div>
            </div>

            {/* Em atraso */}
            <div
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-colors",
                !isLoading && overdueList.length > 0
                  ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/10"
                  : "border-border/70 bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Em atraso
                </span>
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    !isLoading && overdueList.length > 0
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <AlertCircle className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div
                    className={cn(
                      "text-xl font-bold tabular-nums sm:text-2xl",
                      overdueList.length > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-foreground",
                    )}
                  >
                    {formatCents(overdueCents)}
                  </div>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isLoading ? "—" : `${overdueList.length} em atraso`}
                </p>
              </div>
            </div>

            {/* Cancelado */}
            <div
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-colors",
                !isLoading && canceledList.length > 0
                  ? "border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20"
                  : "border-border/70 bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Cancelado
                  </span>
                  {!isLoading && canceledList.length > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      Não cobrado
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    !isLoading && canceledList.length > 0
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Ban className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div
                    className={cn(
                      "text-xl font-bold tabular-nums sm:text-2xl",
                      canceledList.length > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatCents(canceledCents)}
                  </div>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isLoading ? "—" : `${canceledList.length} cancelada(s)`}
                </p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Competência</span>
                <Input
                  type="month"
                  value={competence}
                  onChange={(e) => setCompetence(e.target.value)}
                  className="h-9 w-40"
                  aria-label="Competência"
                />
              </label>

              <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setKindFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    kindFilter === "all"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setKindFilter("membership")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    kindFilter === "membership"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Mensalidades
                </button>
                <button
                  type="button"
                  onClick={() => setKindFilter("dropin")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    kindFilter === "dropin"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Aulas Avulsas
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <ListContainer
            emptyState={
              !isLoading && groups.length === 0 ? (
                <div className="py-6">
                  <ModuleEmptyGuide
                    icon={<Wallet className="size-8" />}
                    title="Nenhuma cobrança nesta competência."
                    description={
                      canManage
                        ? 'Gere as mensalidades do mês com "Gerar cobranças".'
                        : "Ainda não há cobranças para o mês selecionado."
                    }
                    actionLabel={canManage ? "Gerar cobranças" : undefined}
                    onAction={canManage ? generate : undefined}
                  />
                </div>
              ) : null
            }
          >
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                </div>
              ))
            ) : (
              groups.map((group) => {
                // Caso 1: Multi-ciclo (Semanal ou Quinzenal) com Accordion/Expansão
                if (group.isMultiCycle) {
                  const isExpanded = Boolean(expandedKeys[group.key]);

                  return (
                    <div
                      key={group.key}
                      className="border-b border-border/60 transition-colors last:border-b-0"
                    >
                      {/* Linha Consolidada do Aluno */}
                      <div
                        onClick={() => toggleExpand(group.key)}
                        className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5">
                          <InitialsAvatar name={group.studentName} />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground">
                                {group.studentName}
                              </p>
                              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Mensalidade
                              </span>
                              <span className="inline-flex items-center rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                {group.totalCycles === 4
                                  ? "Semanal"
                                  : "Quinzenal"}
                              </span>

                              {/* Progresso de pagamento do mês */}
                              {group.activeCount === 0 ? (
                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  Todas canceladas
                                </span>
                              ) : group.paidCount === group.activeCount ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Quitado ({group.paidCount}/{group.activeCount})
                                </span>
                              ) : group.overdueCount > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                                  {group.overdueCount} em atraso
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {group.paidCount} de {group.activeCount} pagas
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                              {group.className ? (
                                <span>{group.className}</span>
                              ) : null}
                              {group.className && group.planName ? (
                                <span>·</span>
                              ) : null}
                              {group.planName ? (
                                <span>{group.planName}</span>
                              ) : null}
                              <span>·</span>
                              <span>
                                {formatCents(group.unitPriceCents)}
                                {group.periodLabel
                                  ? `/${group.periodLabel}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Totais do Aluno e Botão de Expandir */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                group.activeCount === 0
                                  ? "text-muted-foreground/60 line-through"
                                  : "text-foreground",
                              )}
                            >
                              {formatCents(
                                group.activeCount === 0
                                  ? group.canceledCents
                                  : group.activeTotalCents,
                              )}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {group.charges.length} parcelas
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(group.key);
                            }}
                          >
                            <span>
                              {isExpanded ? "Ocultar" : "Ver parcelas"}
                            </span>
                            <ChevronDown
                              className={cn(
                                "size-3.5 transition-transform duration-200",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </Button>
                        </div>
                      </div>

                      {/* Painel Expandido: Sub-parcelas das semanas/quinzenas */}
                      {isExpanded ? (
                        <div className="space-y-1.5 border-t border-border/50 bg-muted/20 px-4 py-2.5 sm:px-6">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Sub-parcelas do ciclo ({group.charges.length})
                          </p>

                          <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card">
                            {group.charges.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {getCycleTitle(c)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ·
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    vence{" "}
                                    {format(parseISO(c.dueDate), "dd/MM")}
                                  </span>
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none shrink-0",
                                      STATUS_CLASS[c.status],
                                    )}
                                  >
                                    {STATUS_LABEL[c.status]}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-xs font-semibold tabular-nums sm:text-sm",
                                      c.status === "canceled"
                                        ? "text-muted-foreground/60 line-through"
                                        : "text-foreground",
                                    )}
                                  >
                                    {formatCents(c.amountCents)}
                                  </span>

                                  {canManage ? (
                                    c.status === "canceled" ? (
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        disabled={revertMut.isPending}
                                        onClick={() => {
                                          revertMut.mutate(c.id, {
                                            onSuccess: () =>
                                              toast.success(
                                                "Cancelamento revertido com sucesso.",
                                              ),
                                          });
                                        }}
                                        title="Reverter cancelamento"
                                      >
                                        <RotateCcw className="size-3.5" />
                                        Reverter
                                      </Button>
                                    ) : c.status === "paid" ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="size-7"
                                        title="Desfazer pagamento"
                                        onClick={() => {
                                          pendingMut.mutate(c.id, {
                                            onSuccess: () =>
                                              toast.success(
                                                "Pagamento desfeito.",
                                              ),
                                          });
                                        }}
                                      >
                                        <RotateCcw className="size-3.5" />
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="xs"
                                          disabled={paidMut.isPending}
                                          onClick={() => {
                                            paidMut.mutate(
                                              { id: c.id },
                                              {
                                                onSuccess: () =>
                                                  toast.success(
                                                    "Cobrança marcada como paga.",
                                                  ),
                                              },
                                            );
                                          }}
                                        >
                                          <CheckCircle2 className="size-3.5" />
                                          Marcar pago
                                        </Button>

                                        <ListItemActionsMenu
                                          title="Mais opções"
                                          variant="ghost"
                                          actions={[
                                            {
                                              key: "cancel",
                                              label: "Cancelar cobrança",
                                              icon: <Ban className="size-4" />,
                                              destructive: true,
                                              onSelect: () =>
                                                setChargeToCancel(c),
                                            },
                                          ]}
                                        />
                                      </>
                                    )
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                // Caso 2: Linha Simples (Mensalidade Única ou Aula Avulsa)
                const c = group.charges[0];
                if (!c) return null;

                return (
                  <ListRow
                    key={group.key}
                    actions={
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            c.status === "canceled"
                              ? "text-muted-foreground/60 line-through"
                              : "text-foreground",
                          )}
                        >
                          {formatCents(c.amountCents)}
                        </span>

                        {canManage ? (
                          c.status === "canceled" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={revertMut.isPending}
                              onClick={() => {
                                revertMut.mutate(c.id, {
                                  onSuccess: () =>
                                    toast.success(
                                      "Cancelamento revertido com sucesso.",
                                    ),
                                });
                              }}
                              title="Reverter cancelamento"
                            >
                              <RotateCcw className="size-4" />
                              Reverter
                            </Button>
                          ) : c.status === "paid" ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-8"
                              title="Desfazer pagamento"
                              onClick={() => {
                                pendingMut.mutate(c.id, {
                                  onSuccess: () =>
                                    toast.success("Pagamento desfeito."),
                                });
                              }}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={paidMut.isPending}
                                onClick={() => {
                                  paidMut.mutate(
                                    { id: c.id },
                                    {
                                      onSuccess: () =>
                                        toast.success(
                                          "Cobrança marcada como paga.",
                                        ),
                                    },
                                  );
                                }}
                              >
                                <CheckCircle2 className="size-4" />
                                Marcar pago
                              </Button>

                              <ListItemActionsMenu
                                title="Mais opções"
                                variant="ghost"
                                actions={[
                                  {
                                    key: "cancel",
                                    label: "Cancelar cobrança",
                                    icon: <Ban className="size-4" />,
                                    destructive: true,
                                    onSelect: () => setChargeToCancel(c),
                                  },
                                ]}
                              />
                            </>
                          )
                        ) : null}
                      </div>
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <InitialsAvatar name={c.studentName} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {c.studentName}
                          </p>
                          {c.kind === "dropin" ? (
                            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Aula Avulsa
                            </span>
                          ) : c.isProrated ? (
                            <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {c.proratedDays
                                ? `Proporcional (${c.proratedDays}d)`
                                : "Proporcional"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Mensalidade
                            </span>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                              STATUS_CLASS[c.status],
                            )}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                          {c.className ? <span>{c.className}</span> : null}
                          {c.className && c.planName ? <span>·</span> : null}
                          {c.planName ? <span>{c.planName}</span> : null}
                          <span>·</span>
                          <span>
                            {c.kind === "dropin"
                              ? `aula em ${format(parseISO(c.dueDate), "dd/MM")}`
                              : `vence ${format(parseISO(c.dueDate), "dd/MM")}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </ListRow>
                );
              })
            )}
          </ListContainer>
        </div>
      )}

      {/* Confirmação de cancelamento da cobrança */}
      <ConfirmActionDialog
        open={chargeToCancel !== null}
        onOpenChange={(open) => {
          if (!open) setChargeToCancel(null);
        }}
        title="Cancelar cobrança"
        description={
          chargeToCancel ? (
            <>
              Deseja realmente cancelar a cobrança de{" "}
              <strong className="text-foreground">
                {chargeToCancel.studentName}
              </strong>
              {getCycleTitle(chargeToCancel) !== "Mensalidade" ? (
                <> ({getCycleTitle(chargeToCancel)})</>
              ) : null}{" "}
              no valor de{" "}
              <strong className="text-foreground">
                {formatCents(chargeToCancel.amountCents)}
              </strong>
              ? Essa cobrança não comporá o total a receber, mas continuará no
              histórico podendo ser revertida a qualquer momento.
            </>
          ) : null
        }
        confirmLabel="Cancelar cobrança"
        cancelLabel="Voltar"
        variant="destructive"
        isPending={cancelMut.isPending}
        onConfirm={async () => {
          if (!chargeToCancel) return;
          await cancelMut.mutateAsync(chargeToCancel.id);
          toast.success("Cobrança cancelada com sucesso.");
          setChargeToCancel(null);
        }}
      />
    </>
  );
}
