"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, Ban, CheckCircle2, ChevronDown, ChevronLeft, Plus, RotateCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { ListItemContextMenu } from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentMethodLabel } from "@/lib/labels";
import { normalizeText } from "@/lib/text";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents, plural } from "@gestarahub/core/format";
import type { ChargeKind, ChargeStatus, ChargeView, PlanPeriod } from "@gestarahub/contracts";
import { useCurrentUser } from "@/features/auth";
import { CompetencePicker } from "@/features/finance";
import { markDiscoveryVisit } from "@/lib/discovery-flags";
import { useCharges } from "../hooks/use-billing";
import { NewExtraChargeDialog } from "./new-extra-charge-dialog";
import {
  ChargeAmount,
  ChargeDetails,
  ChargeStatusBadge,
  KIND_FILTER_LABEL,
  PERIOD_UNIT,
  PaidViaBadge,
  RecurringLimitBadge,
  STATUS_CLASS,
  STATUS_FILTERS,
  STATUS_LABEL,
  ScholarshipBadge,
  getCycleTitle,
  isChargeKind,
  isReplaced,
  isStatusFilterValue,
  matchesStatusFilter,
  shortDate,
  type StatusFilterValue,
} from "./charge-parts";
import { useChargeActions } from "./use-charge-actions";

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
  planPeriod?: PlanPeriod;
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

/**
 * Agrupa as parcelas do mes de um mesmo plano (semanal/quinzenal). `byCharge`:
 * uma linha por cobranca (atrasos de todos os meses: cada mes e uma divida).
 */
function groupCharges(charges: ChargeView[], byCharge = false): StudentBillingGroup[] {
  const map = new Map<string, StudentBillingGroup>();

  for (const c of charges) {
    const isMembership = c.kind === "membership";
    const key = isMembership && !byCharge ? `${c.studentId}_${c.planId ?? ""}` : c.id;

    if (!map.has(key)) {
      const isMulti = (c.cycleTotal ?? 1) > 1;
      const periodLabel = c.planPeriod ? PERIOD_UNIT[c.planPeriod] : undefined;

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
        planPeriod: c.planPeriod,
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
    // Valor de referencia do plano: a maior parcela (a 1a pode ser proporcional).
    group.unitPriceCents = Math.max(group.unitPriceCents, c.amountCents);

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
    group.charges.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  return Array.from(map.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "pt-BR"),
  );
}

/**
 * Status do grupo de parcelas do mes (semanal/quinzenal), no padrao das linhas
 * simples: atraso primeiro, depois pago, parcial ("2 de 4") e pendente.
 */
function groupStatusOf(group: StudentBillingGroup): { status: ChargeStatus; label: string } {
  if (group.activeCount === 0) return { status: "canceled", label: STATUS_LABEL.canceled };
  if (group.overdueCount > 0) return { status: "overdue", label: STATUS_LABEL.overdue };
  if (group.paidCount === group.activeCount) return { status: "paid", label: STATUS_LABEL.paid };
  if (group.paidCount > 0) {
    return { status: "pending", label: `Parcial · ${group.paidCount} de ${group.activeCount}` };
  }
  return { status: "pending", label: STATUS_LABEL.pending };
}

const currentCompetence = () => format(new Date(), "yyyy-MM");

/**
 * Filtros na URL (o Financeiro linka para ca): `?month=YYYY-MM`,
 * `?status=overdue|pending|paid|canceled` e `?kind=membership|dropin|extra|course|package`. Padroes
 * (mes atual, todos) ficam fora da URL. Mesmo padrao do calendario de turmas.
 * `?overdue=all`: atrasos de todos os meses (ignora mes e situacao).
 */
function useBillingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Ultima URL pedida e ainda nao renderizada: o router.replace e assincrono,
  // entao duas trocas rapidas (filtro e mes) partem dela, senao uma apaga a
  // outra. Mesmo padrao do calendario de turmas.
  const queryString = searchParams.toString();
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    if (pendingQuery.current === queryString) pendingQuery.current = null;
  }, [queryString]);

  const monthParam = searchParams.get("month");
  const competence =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentCompetence();
  const statusParam = searchParams.get("status");
  const statusFilter: StatusFilterValue = isStatusFilterValue(statusParam) ? statusParam : "all";
  const kindParam = searchParams.get("kind");
  const kindFilter: "all" | ChargeKind = isChargeKind(kindParam) ? kindParam : "all";
  const allOverdue = searchParams.get("overdue") === "all";

  const update = (patch: Record<string, string | null>) => {
    // Parte da ultima URL pedida (ou da atual): duas trocas seguidas antes do
    // re-render nao se apagam.
    const params = new URLSearchParams(pendingQuery.current ?? window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    pendingQuery.current = query;
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setCompetence = (next: string) =>
    update({ month: next === currentCompetence() ? null : next, overdue: null });
  // Atrasos de todos os meses: o mes e a situacao nao valem nesse modo.
  const showAllOverdue = (on: boolean) =>
    update({ overdue: on ? "all" : null, month: null, status: null });
  const setStatusFilter = (next: StatusFilterValue) =>
    update({ status: next === "all" ? null : next });
  const setKindFilter = (next: "all" | ChargeKind) => update({ kind: next === "all" ? null : next });
  // Uma unica troca de URL: duas seguidas (status e tipo) se sobrescreviam,
  // porque o router.replace ainda nao tinha atualizado a URL na segunda.
  const clearFilters = () => update({ status: null, kind: null });

  return {
    competence,
    statusFilter,
    kindFilter,
    allOverdue,
    showAllOverdue,
    setCompetence,
    setStatusFilter,
    setKindFilter,
    clearFilters,
  };
}

/** Resumo dos atrasos de todos os meses: total, quantas e de quantos meses. */
function AllOverdueSummary({ charges, isLoading }: { charges: ChargeView[]; isLoading: boolean }) {
  const totalCents = charges.reduce((s, c) => s + c.amountCents, 0);
  const months = new Set(charges.map((c) => c.competence ?? c.dueDate.slice(0, 7))).size;
  const hasOverdue = charges.length > 0;
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-2xs",
        !isLoading && hasOverdue ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/10" : "border-border/70 bg-card",
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">Em atraso até hoje</span>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <div
          className={cn(
            "mt-2 text-xl font-bold tabular-nums sm:text-2xl",
            hasOverdue ? "text-red-600 dark:text-red-400" : "text-foreground",
          )}
        >
          {formatCents(totalCents)}
        </div>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">
        {isLoading
          ? "—"
          : hasOverdue
            ? `${plural(charges.length, "cobrança", "cobranças")} de ${plural(months, "mês", "meses")}`
            : "Nenhuma cobrança em atraso"}
      </p>
    </div>
  );
}

export function BillingView() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const {
    competence,
    statusFilter: monthStatusFilter,
    kindFilter,
    allOverdue,
    showAllOverdue,
    setCompetence,
    setStatusFilter,
    setKindFilter,
    clearFilters,
  } =
    useBillingFilters();
  // Todos os atrasos: so cobrancas em atraso, de qualquer mes.
  const statusFilter: StatusFilterValue = allOverdue ? "overdue" : monthStatusFilter;
  const [newChargeOpen, setNewChargeOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Abrir as parcelas de curso conclui "Ver as parcelas do curso" (Dashboard).
  const user = useCurrentUser();
  useEffect(() => {
    if (kindFilter === "course") markDiscoveryVisit(user, "course_billing");
  }, [kindFilter, user]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    data: charges,
    isLoading,
    isError,
    refetch,
  } = useCharges(
    allOverdue
      ? { status: "overdue", kind: kindFilter === "all" ? undefined : kindFilter }
      : { competence, kind: kindFilter === "all" ? undefined : kindFilter },
  );
  // Faixa "em atraso de meses anteriores" (so no mes atual): a divida nao some
  // na virada do mes.
  const isCurrentMonth = !allOverdue && competence === currentCompetence();
  const { data: allOverdueCharges } = useCharges({ status: "overdue" });
  const earlierOverdue = isCurrentMonth
    ? (allOverdueCharges ?? []).filter((c) => (c.competence ?? c.dueDate.slice(0, 7)) < competence)
    : [];
  const earlierOverdueCents = earlierOverdue.reduce((s, c) => s + c.amountCents, 0);
  const chargeActions = useChargeActions();
  const { canManage, overRecurringLimit } = chargeActions;
  const withChargeContextMenu = chargeActions.withContextMenu;
  const renderChargeActions = chargeActions.renderActions;

  const list = charges ?? [];
  // Status e busca filtram so a lista; os cartoes seguem mostrando o mes inteiro.
  const query = normalizeText(search);
  const filteredList = list.filter(
    (c) =>
      matchesStatusFilter(c, statusFilter) &&
      (query === "" ||
        normalizeText(c.studentName).includes(query) ||
        (c.description !== undefined && normalizeText(c.description).includes(query))),
  );
  const groups = groupCharges(filteredList, allOverdue);
  const hasListFilters = allOverdue
    ? kindFilter !== "all" || query !== ""
    : statusFilter !== "all" || kindFilter !== "all" || query !== "";
  const clearListFilters = () => {
    setSearch("");
    if (allOverdue) setKindFilter("all");
    else clearFilters();
  };

  // Isentas (bolsa integral) nao entram nos totais: R$ 0 e nada a receber.
  const activeList = list.filter((c) => c.status !== "canceled" && c.status !== "waived");
  const activeTotalCents = activeList.reduce((s, c) => s + c.amountCents, 0);

  const waivedCount = list.filter((c) => c.status === "waived").length;

  const paidList = list.filter((c) => c.status === "paid");
  const paidCents = paidList.reduce((s, c) => s + c.amountCents, 0);

  const overdueList = list.filter((c) => c.status === "overdue");
  const overdueCents = overdueList.reduce((s, c) => s + c.amountCents, 0);

  // So o que deixou de ser cobrado: substituida (troca de plano/regra/bolsa) nao e perda.
  const canceledList = list.filter((c) => c.status === "canceled" && !isReplaced(c));
  const replacedCount = list.filter(isReplaced).length;
  const canceledCents = canceledList.reduce((s, c) => s + c.amountCents, 0);

  // Mensalidades nascem sozinhas no mes atual; meses futuros aparecem quando chegarem.
  const isFutureCompetence = competence > format(new Date(), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Cobranças"
        description={
          allOverdue
            ? "Cobranças em atraso de todos os meses, até hoje."
            : "Cobranças do mês. As mensalidades são geradas sozinhas."
        }
      >
        {allOverdue ? (
          <Button variant="outline" onClick={() => showAllOverdue(false)}>
            <ChevronLeft className="size-4" />
            Ver por mês
          </Button>
        ) : (
          // Mesmo seletor de mes do Financeiro (com "Atual" e grade de meses)
          <CompetencePicker competence={competence} onChange={setCompetence} />
        )}
        {canManage ? (
          <Button onClick={() => setNewChargeOpen(true)}>
            <Plus className="size-4" />
            Nova cobrança
          </Button>
        ) : null}
      </PageHeader>

      {!mounted ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : (
        <div className="space-y-4">
          {allOverdue ? (
            <AllOverdueSummary charges={list} isLoading={isLoading} />
          ) : (
          /* KPI Summary Cards */
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
                  {isLoading
                    ? "—"
                    : waivedCount > 0
                      ? `${plural(activeList.length, "ativa", "ativas")} · ${plural(waivedCount, "isenta", "isentas")}`
                      : plural(activeList.length, "ativa", "ativas")}
                </p>
              </div>
            </div>

            {/* Recebido */}
            <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Recebido
                </span>
                <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
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
                  {isLoading ? "—" : plural(paidList.length, "paga", "pagas")}
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
                    <span className="hidden items-center rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 sm:inline-flex">
                      Não cobrado
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    !isLoading && canceledList.length > 0
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
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
                  {isLoading ? "—" : plural(canceledList.length, "cancelada", "canceladas")}
                </p>
              </div>
            </div>
          </div>
          )}

          {earlierOverdue.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 dark:bg-red-950/10">
              <p className="flex items-center gap-2 text-sm">
                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {formatCents(earlierOverdueCents)}
                  </span>{" "}
                  em atraso de meses anteriores
                </span>
              </p>
              <Button variant="outline" onClick={() => showAllOverdue(true)}>
                Ver todos os atrasos
              </Button>
            </div>
          ) : null}

          {/* Busca + filtros (padrao das listas: busca e selects lado a lado) */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar aluno..."
              aria-label="Buscar aluno"
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                value={kindFilter}
                onValueChange={(v) => setKindFilter(v as "all" | ChargeKind)}
              >
                <SelectTrigger className="sm:w-auto sm:min-w-44" aria-label="Filtrar por tipo">
                  <SelectValue>{KIND_FILTER_LABEL[kindFilter]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_FILTER_LABEL) as ("all" | ChargeKind)[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_FILTER_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allOverdue ? null : (
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}
              >
                <SelectTrigger className="sm:w-auto sm:min-w-44" aria-label="Filtrar por situação">
                  <SelectValue>
                    {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((f) => {
                    // Quantas ha no mes (com o tipo escolhido), para achar rapido.
                    const count = list.filter((c) => matchesStatusFilter(c, f.value)).length;
                    return (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="flex w-full items-center justify-between gap-3">
                          {f.label}
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              )}
            </div>
          </div>

          <ListSummaryBar
            count={filteredList.length}
            singularLabel="cobrança"
            pluralLabel="cobranças"
            isLoading={isLoading}
            hasFilters={hasListFilters}
            onClearFilters={clearListFilters}
          />
          {statusFilter === "all" && replacedCount > 0 ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {replacedCount === 1
                ? "1 cobrança substituída por troca de plano ou regra está oculta."
                : `${replacedCount} cobranças substituídas por troca de plano ou regra estão ocultas.`}{" "}
              <button
                type="button"
                onClick={() => setStatusFilter("replaced")}
                className="font-medium text-primary hover:underline"
              >
                Mostrar
              </button>
            </p>
          ) : null}

          {/* List */}
          <ListContainer
            emptyState={
              !isLoading && isError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar as cobranças. Tente novamente.
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RotateCw className="size-4" />
                    Tentar novamente
                  </Button>
                </div>
              ) : !isLoading && groups.length === 0 && (list.length > 0 || kindFilter !== "all") ? (
                // O tipo filtra na consulta: lista vazia com tipo escolhido
                // ainda e "filtro sem resultado", nao mes sem cobranca.
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {allOverdue
                      ? query !== ""
                        ? `Nenhum atraso de “${search.trim()}” com estes filtros.`
                        : "Nenhum atraso deste tipo."
                      : query !== ""
                      ? `Nenhuma cobrança de “${search.trim()}” com estes filtros no mês.`
                      : list.length === 0
                        ? kindFilter === "dropin"
                          ? "Nenhuma aula avulsa neste mês."
                          : kindFilter === "extra"
                            ? "Nenhuma cobrança avulsa neste mês."
                            : kindFilter === "course"
                              ? "Nenhuma parcela de curso neste mês."
                              : kindFilter === "package"
                                ? "Nenhum pacote neste mês."
                                : "Nenhuma mensalidade neste mês."
                        : "Nenhuma cobrança com esta situação no mês."}
                  </p>
                  <Button variant="outline" onClick={clearListFilters}>
                    Limpar filtros
                  </Button>
                </div>
              ) : !isLoading && groups.length === 0 && allOverdue ? (
                <div className="py-6">
                  <ModuleEmptyGuide
                    icon={<CheckCircle2 className="size-8" />}
                    title="Nenhuma cobrança em atraso."
                    description="Todos os alunos estão em dia."
                  />
                </div>
              ) : !isLoading && groups.length === 0 ? (
                <div className="py-6">
                  <ModuleEmptyGuide
                    icon={<Wallet className="size-8" />}
                    title="Nenhuma cobrança nesta competência."
                    description={
                      isFutureCompetence
                        ? "As mensalidades deste mês aparecem quando ele começar."
                        : "Nenhum aluno com mensalidade ou aula avulsa neste mês."
                    }
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
                // Caso 1: Multi-ciclo (Semanal ou Quinzenal) com 2+ parcelas no mes.
                // Com uma parcela so, cai na linha simples (status e menu diretos).
                if (group.isMultiCycle && group.charges.length > 1) {
                  const isExpanded = Boolean(expandedKeys[group.key]);

                  return (
                    <div
                      key={group.key}
                      className="border-b border-border/60 transition-colors last:border-b-0"
                    >
                      {/* Linha Consolidada do Aluno (clique direito: abre ou fecha as parcelas) */}
                      <ListItemContextMenu
                        actions={[
                          {
                            key: "toggle",
                            label: isExpanded ? "Ocultar parcelas" : "Ver parcelas",
                            icon: <ChevronDown className="size-4" />,
                            onSelect: () => toggleExpand(group.key),
                          },
                        ]}
                      >
                        <div
                          onClick={() => toggleExpand(group.key)}
                          className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-nowrap sm:px-5"
                        >
                          <div className="flex min-w-0 flex-1 basis-full items-center gap-3.5 sm:basis-0">
                            <InitialsAvatar name={group.studentName} />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/clients/${group.studentId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="min-w-0 break-words text-sm font-medium text-foreground hover:text-primary hover:underline"
                                >
                                  {group.studentName}
                                </Link>
                                {/* Status do mes, no mesmo padrao das linhas simples */}
                                {(() => {
                                  const groupStatus = groupStatusOf(group);
                                  return (
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                                        STATUS_CLASS[groupStatus.status],
                                      )}
                                    >
                                      {groupStatus.label}
                                    </span>
                                  );
                                })()}
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
                          <div className="ml-auto flex items-center gap-3">
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
                                {plural(group.charges.length, "parcela", "parcelas")}
                              </p>
                            </div>

                            <Button
                              variant="outline"
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
                      </ListItemContextMenu>

                      {/* Painel Expandido: Sub-parcelas das semanas/quinzenas */}
                      {isExpanded ? (
                        <div className="space-y-1.5 border-t border-border/50 bg-muted/20 px-4 py-2.5 sm:px-6">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {plural(group.charges.length, "cobrança", "cobranças")} no mês
                          </p>

                          <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card">
                            {group.charges.map((c) => withChargeContextMenu(
                              c,
                              <div
                                key={c.id}
                                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 py-2.5 sm:flex-nowrap sm:px-4"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {getCycleTitle(c)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ·
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    vence {shortDate(c.dueDate)}
                                    {c.status === "paid" && c.method
                                      ? ` · ${paymentMethodLabel(c.method)}`
                                      : ""}
                                  </span>
                                  <ChargeStatusBadge charge={c} size="sm" />
                                  <PaidViaBadge charge={c} />
                                  <ScholarshipBadge charge={c} />
                                  <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                                </div>

                                <div className="flex items-center gap-2">
                                  <ChargeAmount
                                    charge={c}
                                    className="text-xs font-semibold tabular-nums sm:text-sm"
                                  />

                                  {renderChargeActions(c, true)}
                                </div>
                              </div>,
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

                return withChargeContextMenu(
                  c,
                  <ListRow
                    key={group.key}
                    // No celular, valor e ações descem para baixo do texto.
                    className="flex-wrap gap-y-2 sm:flex-nowrap [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0 [&>div:last-child]:ml-auto"
                    actions={
                      <div className="flex items-center gap-2">
                        <ChargeAmount charge={c} className="text-sm font-medium tabular-nums" />

                        {renderChargeActions(c, false)}
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
                          {/* So a aula avulsa tem selo de tipo; mensalidade e o padrao da tela. */}
                          {c.kind === "dropin" ? (
                            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              Aula Avulsa
                            </span>
                          ) : null}
                          {c.status === "waived" ? null : <ChargeStatusBadge charge={c} />}
                          <PaidViaBadge charge={c} />
                          <ScholarshipBadge charge={c} />
                          <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                        </div>

                        <ChargeDetails charge={c} />
                      </div>
                    </div>
                  </ListRow>,
                );
              })
            )}
          </ListContainer>
        </div>
      )}

      {chargeActions.dialogs}
      <NewExtraChargeDialog
        open={newChargeOpen}
        onOpenChange={setNewChargeOpen}
        onCreated={(created) => {
          // Vencimento em outro mes: abre o mes da primeira parcela, onde ela aparece.
          const first = created[0]?.competence;
          if (first && first !== competence) setCompetence(first);
        }}
      />
    </>
  );
}
