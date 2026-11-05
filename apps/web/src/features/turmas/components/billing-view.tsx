"use client";

import { PausedTag } from "@/features/clients";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Ban, CheckCircle2, ChevronDown, ChevronLeft, Plus, RotateCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
  ListSummaryBar,
  PaginationBar,
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
import type { ChargeKind, ChargeStatus, ChargeView } from "@gestarahub/contracts";
import { useCan, useCurrentUser } from "@/features/auth";
import { useUserPreferences } from "@/features/preferences";
import { CompetencePicker } from "@/features/finance";
import { markDiscoveryVisit } from "@/lib/discovery-flags";
import { useCharges } from "../hooks/use-billing";
import { NewExtraChargeDialog } from "./new-extra-charge-dialog";
import {
  ChargeAmount,
  ChargeStatusBadge,
  KIND_FILTER_LABEL,
  PaidViaBadge,
  REPLACED_CLASS,
  RecurringLimitBadge,
  STATUS_CLASS,
  STATUS_FILTERS,
  STATUS_LABEL,
  ScholarshipBadge,
  cancelReasonOf,
  chargeSubject,
  getCycleTitle,
  installmentLabel,
  isChargeKind,
  isInstallmentKind,
  isReplaced,
  isStatusFilterValue,
  isSystemCanceled,
  matchesStatusFilter,
  shortDate,
  type StatusFilterValue,
} from "./charge-parts";
import { useChargeActions } from "./use-charge-actions";
import { dateInSpace } from "@gestarahub/core/date";

interface StudentConsolidatedGroup {
  studentId: string;
  studentName: string;
  studentPaused: boolean;
  charges: ChargeView[];
  activeTotalCents: number;
  openCents: number;
  overdueCents: number;
  paidCents: number;
  canceledCents: number;
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
  waivedCount: number;
  closedCount: number;
}

/**
 * Agrupa as cobrancas visiveis por aluno (`studentId`) para que cada aluno
 * apareca uma unica vez na lista, consolidando mensalidade, pacotes e avulsas.
 */
function groupByStudent(charges: ChargeView[]): StudentConsolidatedGroup[] {
  const map = new Map<string, StudentConsolidatedGroup>();

  for (const c of charges) {
    if (!map.has(c.studentId)) {
      map.set(c.studentId, {
        studentId: c.studentId,
        studentName: c.studentName,
        studentPaused: Boolean(c.studentPaused),
        charges: [],
        activeTotalCents: 0,
        openCents: 0,
        overdueCents: 0,
        paidCents: 0,
        canceledCents: 0,
        overdueCount: 0,
        pendingCount: 0,
        paidCount: 0,
        waivedCount: 0,
        closedCount: 0,
      });
    }
    const g = map.get(c.studentId)!;
    g.charges.push(c);

    if (c.status === "canceled") {
      g.canceledCents += c.amountCents;
      g.closedCount += 1;
    } else if (c.status === "waived") {
      g.waivedCount += 1;
    } else {
      g.activeTotalCents += c.amountCents;
      if (c.status === "overdue") {
        g.overdueCents += c.amountCents;
        g.openCents += c.amountCents;
        g.overdueCount += 1;
      } else if (c.status === "pending") {
        g.openCents += c.amountCents;
        g.pendingCount += 1;
      } else if (c.status === "paid") {
        g.paidCents += c.amountCents;
        g.paidCount += 1;
      }
    }
  }

  const statusOrder: Record<ChargeStatus, number> = {
    overdue: 0,
    pending: 1,
    paid: 2,
    waived: 3,
    canceled: 4,
  };

  for (const g of map.values()) {
    g.charges.sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.dueDate.localeCompare(b.dueDate),
    );
  }

  return Array.from(map.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "pt-BR"),
  );
}

function studentGroupBadge(g: StudentConsolidatedGroup): {
  label: string;
  className: string;
} {
  const activeCount = g.overdueCount + g.pendingCount + g.paidCount;
  if (activeCount === 0) {
    if (g.waivedCount > 0 && g.closedCount === 0) {
      return { label: "Bolsista", className: STATUS_CLASS.waived };
    }
    const allSystem = g.charges.every((c) => isSystemCanceled(c) || isReplaced(c));
    return {
      label: allSystem ? "Encerrado" : STATUS_LABEL.canceled,
      className: allSystem ? REPLACED_CLASS : STATUS_CLASS.canceled,
    };
  }
  if (g.overdueCount > 0) {
    return {
      label:
        g.charges.length > 1 && g.overdueCount < activeCount
          ? `${g.overdueCount} em atraso`
          : STATUS_LABEL.overdue,
      className: STATUS_CLASS.overdue,
    };
  }
  if (g.pendingCount > 0 && g.paidCount > 0) {
    return {
      label: `Parcial · ${g.paidCount} de ${activeCount}`,
      className: STATUS_CLASS.pending,
    };
  }
  if (g.pendingCount > 0) {
    return { label: STATUS_LABEL.pending, className: STATUS_CLASS.pending };
  }
  return { label: STATUS_LABEL.paid, className: STATUS_CLASS.paid };
}

function cleanSingleSubtitle(c: ChargeView): string {
  const parts: string[] = [];
  if (c.kind === "dropin") {
    parts.push(c.className ? `Aula avulsa · ${c.className}` : "Aula avulsa");
    parts.push(`aula em ${shortDate(c.dueDate)}`);
  } else if (isInstallmentKind(c)) {
    const inst = installmentLabel(c);
    parts.push(inst ? `${chargeSubject(c)} (${inst})` : chargeSubject(c));
    parts.push(`vence ${shortDate(c.dueDate)}`);
  } else {
    if (c.className) parts.push(c.className);
    if (c.planName) parts.push(c.planName);
    parts.push(`vence ${shortDate(c.dueDate)}`);
  }
  const reason = cancelReasonOf(c);
  if (reason) parts.push(reason);
  // Pix ou link em aberto que o aluno ja abriu (pagina /p/<codigo>).
  if (c.onlineOpenedAt && (c.status === "pending" || c.status === "overdue")) parts.push("link aberto");
  if (c.status === "paid") {
    const how = c.method ? ` via ${paymentMethodLabel(c.method)}` : "";
    parts.push(`${c.paidVia === "online" ? "pago online" : "pago"}${how}`);
  }
  return parts.join(" · ");
}

function cleanGroupSubtitle(g: StudentConsolidatedGroup): string {
  const countByKind = new Map<ChargeKind, number>();
  for (const c of g.charges) {
    countByKind.set(c.kind, (countByKind.get(c.kind) ?? 0) + 1);
  }
  const items: string[] = [];
  const memberships = countByKind.get("membership") ?? 0;
  if (memberships > 0) {
    const planName = g.charges.find((c) => c.kind === "membership")?.planName;
    items.push(planName ?? plural(memberships, "mensalidade", "mensalidades"));
  }
  const packages = countByKind.get("package") ?? 0;
  if (packages > 0) items.push(plural(packages, "pacote", "pacotes"));
  const dropins = countByKind.get("dropin") ?? 0;
  if (dropins > 0) items.push(plural(dropins, "aula avulsa", "aulas avulsas"));
  const courses = countByKind.get("course") ?? 0;
  if (courses > 0) items.push(plural(courses, "curso", "cursos"));
  const extras = countByKind.get("extra") ?? 0;
  if (extras > 0) items.push(plural(extras, "cobrança avulsa", "cobranças avulsas"));

  const dates = Array.from(
    new Set(
      g.charges
        .filter((c) => c.status !== "canceled" && c.status !== "waived")
        .map((c) => shortDate(c.dueDate)),
    ),
  );
  const datePart =
    dates.length === 1
      ? `vence ${dates[0]}`
      : dates.length === 2
        ? `vence ${dates[0]} e ${dates[1]}`
        : dates.length > 2
          ? `vence ${dates[0]}, ${dates[1]} +${dates.length - 2}`
          : null;

  return [items.join(" + "), datePart].filter(Boolean).join(" · ");
}

function subItemTitle(c: ChargeView): string {
  if (c.kind === "dropin") {
    return `Aula avulsa${c.className ? ` · ${c.className}` : ""}`;
  }
  if (isInstallmentKind(c)) {
    const inst = installmentLabel(c);
    return inst ? `${chargeSubject(c)} (${inst})` : chargeSubject(c);
  }
  if ((c.cycleTotal ?? 1) > 1) {
    return `${c.planName ?? "Plano"} · ${getCycleTitle(c)}`;
  }
  return c.planName ?? getCycleTitle(c);
}

const currentCompetence = () => dateInSpace().slice(0, 7);

/**
 * Filtros na URL (o Financeiro linka para ca): `?month=YYYY-MM`,
 * `?status=all|overdue|pending|paid|other|canceled|waived|replaced` e
 * `?kind=membership|dropin|extra|course|package`.
 * Padrao inicial sem `?status=` na URL: `"open"` (A receber: pendentes + em atraso).
 */
function useBillingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    if (pendingQuery.current === queryString) pendingQuery.current = null;
  }, [queryString]);

  const monthParam = searchParams.get("month");
  const competence =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentCompetence();
  const statusParam = searchParams.get("status");
  const statusFilter: StatusFilterValue = isStatusFilterValue(statusParam) ? statusParam : "open";
  const kindParam = searchParams.get("kind");
  const kindFilter: "all" | ChargeKind = isChargeKind(kindParam) ? kindParam : "all";
  const allOverdue = searchParams.get("overdue") === "all";

  const update = (patch: Record<string, string | null>) => {
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
  const showAllOverdue = (on: boolean) =>
    update({ overdue: on ? "all" : null, month: null, status: null });
  const setStatusFilter = (next: StatusFilterValue) =>
    update({ status: next === "open" ? null : next });
  const setKindFilter = (next: "all" | ChargeKind) => update({ kind: next === "all" ? null : next });
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
  } = useBillingFilters();
  const statusFilter: StatusFilterValue = allOverdue ? "overdue" : monthStatusFilter;
  const [newChargeOpen, setNewChargeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const user = useCurrentUser();
  const can = useCan();
  const canViewFinance = can("finance:view");
  useEffect(() => {
    if (kindFilter === "course") markDiscoveryVisit(user, "course_billing");
  }, [kindFilter, user]);
  const { preferences } = useUserPreferences();
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () => preferences.pageSizes?.billing ?? preferences.defaultPageSize ?? 25,
  );

  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const {
    data: charges,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useCharges(
    allOverdue
      ? { status: "overdue", kind: kindFilter === "all" ? undefined : kindFilter }
      : { competence, kind: kindFilter === "all" ? undefined : kindFilter },
  );
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
  const query = normalizeText(search);
  const searchMatchedList = list.filter(
    (c) =>
      query === "" ||
      normalizeText(c.studentName).includes(query) ||
      (c.description !== undefined && normalizeText(c.description).includes(query)),
  );
  const filteredList = searchMatchedList.filter((c) => matchesStatusFilter(c, statusFilter));
  const filterKey = `${search}:${kindFilter}:${statusFilter}:${competence}:${allOverdue}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const studentGroups = groupByStudent(filteredList);
  const totalGroups = studentGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const paginatedStudentGroups = studentGroups.slice((page - 1) * pageSize, page * pageSize);

  const hasListFilters = allOverdue
    ? kindFilter !== "all" || query !== ""
    : statusFilter !== "open" || kindFilter !== "all" || query !== "";
  const clearListFilters = () => {
    setSearch("");
    if (allOverdue) setKindFilter("all");
    else clearFilters();
  };

  // Totais dos cartoes de resumo do mes (sempre sobre o mes inteiro).
  const activeList = list.filter((c) => c.status !== "canceled" && c.status !== "waived");
  const activeTotalCents = activeList.reduce((s, c) => s + c.amountCents, 0);

  const waivedCount = list.filter((c) => c.status === "waived").length;

  const paidList = list.filter((c) => c.status === "paid");
  const paidCents = paidList.reduce((s, c) => s + c.amountCents, 0);

  const overdueList = list.filter((c) => c.status === "overdue");
  const overdueCents = overdueList.reduce((s, c) => s + c.amountCents, 0);

  // So o que deixou de ser cobrado por decisao do usuario: substituida (troca de
  // plano/regra/bolsa) e encerrada pelo sistema (saida da aula, futuro nao iniciado) nao sao perda.
  const canceledList = list.filter((c) => c.status === "canceled" && !isReplaced(c) && !isSystemCanceled(c));
  const replacedCount = list.filter(isReplaced).length;
  const canceledCents = canceledList.reduce((s, c) => s + c.amountCents, 0);

  // Contadores das abas rapidas (respeitam a busca por nome e o tipo selecionado).
  const openTabCount = searchMatchedList.filter((c) => matchesStatusFilter(c, "open")).length;
  const overdueTabCount = searchMatchedList.filter((c) => matchesStatusFilter(c, "overdue")).length;
  const paidTabCount = searchMatchedList.filter((c) => matchesStatusFilter(c, "paid")).length;
  const otherTabCount = searchMatchedList.filter((c) => matchesStatusFilter(c, "other")).length;

  const quickTabs: { id: StatusFilterValue; label: string; count: number; alert?: boolean }[] = [
    { id: "open", label: "A receber", count: openTabCount },
    {
      id: "overdue",
      label: "Em atraso",
      count: overdueTabCount,
      alert: overdueTabCount > 0,
    },
    { id: "paid", label: "Pagas", count: paidTabCount },
    ...(otherTabCount > 0 || statusFilter === "other"
      ? [{ id: "other" as const, label: "Isentas e encerradas", count: otherTabCount }]
      : []),
  ];

  const isFutureCompetence = competence > dateInSpace().slice(0, 7);

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
          {canViewFinance && (
            allOverdue ? (
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
          ))}

          {earlierOverdue.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 dark:bg-red-950/10">
              <p className="flex items-center gap-2 text-sm">
                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {canViewFinance
                      ? formatCents(earlierOverdueCents)
                      : plural(earlierOverdue.length, "1 cobrança", `${earlierOverdue.length} cobranças`)}
                  </span>{" "}
                  em atraso de meses anteriores
                </span>
              </p>
              <Button variant="outline" onClick={() => showAllOverdue(true)}>
                Ver todos os atrasos
              </Button>
            </div>
          ) : null}

          {/* Busca + filtros */}
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

          {/* Abas rápidas de foco (A receber | Em atraso | Pagas | Isentas e encerradas) */}
          {!allOverdue && !isLoading && !isError && list.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
                {quickTabs.map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-background text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums",
                          tab.alert
                            ? "bg-red-500/15 text-red-700 dark:text-red-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {plural(studentGroups.length, "aluno", "alunos")} ·{" "}
                  {plural(filteredList.length, "cobrança", "cobranças")}
                </span>
                {hasListFilters ? (
                  <button
                    type="button"
                    onClick={clearListFilters}
                    className="font-medium text-primary hover:underline"
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <ListSummaryBar
              count={filteredList.length}
              singularLabel="cobrança"
              pluralLabel="cobranças"
              isLoading={isLoading}
              hasFilters={hasListFilters}
              onClearFilters={clearListFilters}
            />
          )}

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
            // Buscando de novo depois de marcar pago, cancelar ou criar: barrinha no topo.
            refreshing={isFetching && !isLoading}
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
              ) : !isLoading && studentGroups.length === 0 && (list.length > 0 || kindFilter !== "all") ? (
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
                          : statusFilter === "open"
                            ? "Nenhuma cobrança a receber neste mês."
                            : "Nenhuma cobrança com esta situação no mês."}
                  </p>
                  {hasListFilters ? (
                    <Button variant="outline" onClick={clearListFilters}>
                      Limpar filtros
                    </Button>
                  ) : list.length > 0 && statusFilter === "open" ? (
                    <Button variant="outline" onClick={() => setStatusFilter("all")}>
                      Ver todas do mês
                    </Button>
                  ) : null}
                </div>
              ) : !isLoading && studentGroups.length === 0 && allOverdue ? (
                <div className="py-6">
                  <ModuleEmptyGuide
                    icon={<CheckCircle2 className="size-8" />}
                    title="Nenhuma cobrança em atraso."
                    description="Todos os alunos estão em dia."
                  />
                </div>
              ) : !isLoading && studentGroups.length === 0 ? (
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
              paginatedStudentGroups.map((group) => {
                // Caso 1: Aluno com 1 única cobrança na visão atual -> linha direta e limpa
                if (group.charges.length === 1) {
                  const c = group.charges[0]!;
                  return withChargeContextMenu(
                    c,
                    <ListRow
                      key={c.id}
                      className="flex-wrap gap-y-2 sm:flex-nowrap [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0 [&>div:last-child]:ml-auto"
                      actions={
                        <div className="flex items-center gap-2.5">
                          <ChargeAmount charge={c} className="text-sm font-semibold tabular-nums" />
                          {/* min-w, nao size: com recibo e desfazer lado a lado a caixa cresce (achado 85). */}
                          <div className="flex min-h-8 min-w-8 items-center justify-center">
                            {renderChargeActions(c, false)}
                          </div>
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
                            {c.studentPaused ? <PausedTag /> : null}
                            {c.status === "waived" ? null : <ChargeStatusBadge charge={c} />}
                            <PaidViaBadge charge={c} />
                            <ScholarshipBadge charge={c} />
                            <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                          </div>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {cleanSingleSubtitle(c)}
                          </p>
                        </div>
                      </div>
                    </ListRow>,
                  );
                }

                // Caso 2: Aluno com 2+ cobranças na visão atual -> linha consolidada por aluno
                const isExpanded = Boolean(expandedStudents[group.studentId]);
                const badge = studentGroupBadge(group);
                const displayTotal =
                  group.activeTotalCents > 0 ? group.activeTotalCents : group.canceledCents;
                const hasPartialOverdue =
                  group.overdueCount > 0 && group.overdueCents < group.activeTotalCents;

                return (
                  <div
                    key={group.studentId}
                    className="border-b border-border/60 transition-colors last:border-b-0"
                  >
                    <ListItemContextMenu
                      actions={[
                        {
                          key: "toggle",
                          label: isExpanded ? "Ocultar cobranças" : "Ver cobranças",
                          icon: <ChevronDown className="size-4" />,
                          onSelect: () => toggleStudent(group.studentId),
                        },
                      ]}
                    >
                      <div
                        onClick={() => toggleStudent(group.studentId)}
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
                              {group.studentPaused ? <PausedTag /> : null}
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </span>
                            </div>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {cleanGroupSubtitle(group)}
                            </p>
                          </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2.5">
                          <div className="text-right">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                group.activeTotalCents === 0
                                  ? "text-muted-foreground/60 line-through"
                                  : "text-foreground",
                              )}
                            >
                              {formatCents(displayTotal)}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {hasPartialOverdue ? (
                                <>
                                  <span className="font-medium text-red-600 dark:text-red-400">
                                    {formatCents(group.overdueCents)} vencido
                                  </span>
                                  {" · "}
                                  {plural(group.charges.length, "cobrança", "cobranças")}
                                </>
                              ) : (
                                plural(group.charges.length, "cobrança", "cobranças")
                              )}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            aria-label={isExpanded ? "Ocultar cobranças" : "Ver cobranças"}
                            title={isExpanded ? "Ocultar cobranças" : "Ver cobranças"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStudent(group.studentId);
                            }}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform duration-200",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                    </ListItemContextMenu>

                    {isExpanded ? (
                      <div className="border-t border-border/50 bg-muted/20 px-4 py-2.5 sm:px-6">
                        <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card">
                          {group.charges.map((c) =>
                            withChargeContextMenu(
                              c,
                              <div
                                key={c.id}
                                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 py-2.5 sm:flex-nowrap sm:px-4"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">
                                      {subItemTitle(c)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      · {c.kind === "dropin" ? `aula em ${shortDate(c.dueDate)}` : `vence ${shortDate(c.dueDate)}`}
                                      {c.status === "paid" && c.method ? ` · ${paymentMethodLabel(c.method)}` : ""}
                                      {c.onlineOpenedAt && (c.status === "pending" || c.status === "overdue") ? " · link aberto" : ""}
                                    </span>
                                    {c.status === "waived" ? null : <ChargeStatusBadge charge={c} size="sm" />}
                                    <PaidViaBadge charge={c} />
                                    <ScholarshipBadge charge={c} />
                                    <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <ChargeAmount
                                    charge={c}
                                    className="text-xs font-semibold tabular-nums sm:text-sm"
                                  />
                                  <div className="flex min-h-7 min-w-7 items-center justify-center">
                                    {renderChargeActions(c, true)}
                                  </div>
                                </div>
                              </div>,
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </ListContainer>

          {!isLoading && studentGroups.length > 0 ? (
            <PaginationBar
              screenKey="billing"
              page={page}
              pageSize={pageSize}
              total={totalGroups}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              itemLabel="alunos com cobranças"
            />
          ) : null}
        </div>
      )}

      {chargeActions.dialogs}
      <NewExtraChargeDialog
        open={newChargeOpen}
        onOpenChange={setNewChargeOpen}
        onCreated={(created) => {
          // Mes da 1a parcela: o vencimento mais cedo (a avulsa pode vir sem competencia).
          const first = created.map((c) => c.competence || c.dueDate.slice(0, 7)).sort()[0];
          if (first && first !== competence) setCompetence(first);
        }}
      />
    </>
  );
}
