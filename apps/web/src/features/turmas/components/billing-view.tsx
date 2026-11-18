"use client";

import { PausedTag } from "@/features/clients";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Ban, CheckCircle2, ChevronDown, ChevronLeft, Plus, RotateCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBar } from "@/components/form";
import { StatCard } from "@/components/shared/stat-card";
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
import type { ChargeFilter, ChargeKind, ChargeStatus, ChargeView } from "@gestarahub/contracts";
import { useCan, useCurrentUser } from "@/features/auth";
import { useUserPreferences } from "@/features/preferences";
import { CompetencePicker, competenceLabel } from "@/features/finance";
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
  statusLabelOf,
  ScholarshipBadge,
  WhatsAppSentBadge,
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
  type SubtitlePart,
  cleanSingleSubtitle,
  duePart,
  dueVerb,
  renderSubtitle,
  statusRepeatsTab,
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
      // Tom "vencido" (mais calmo que o vermelho cheio), como a data e o valor vencidos.
      className: "border-overdue/25 bg-overdue/10 text-overdue",
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

function cleanGroupSubtitle(g: StudentConsolidatedGroup): SubtitlePart[] {
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

  const shown = g.charges.filter((c) => c.status !== "canceled" && c.status !== "waived");
  // Vencidas e por vencer separadas (11/11/2026): "venceu 04/11" em vermelho e
  // "vence 25/11" normal. Antes um "vence" so cobria as duas e escondia o atraso.
  const datesOf = (list: ChargeView[]) => Array.from(new Set(list.map((c) => shortDate(c.dueDate))));
  const datesText = (verb: string, dates: string[]) =>
    dates.length === 0
      ? null
      : dates.length === 1
        ? `${verb} ${dates[0]}`
        : dates.length === 2
          ? `${verb} ${dates[0]} e ${dates[1]}`
          : `${verb} ${dates[0]}, ${dates[1]} +${dates.length - 2}`;
  const late = shown.filter((c) => dueVerb(c.dueDate, c.status) === "venceu" && c.status !== "paid");
  const rest = shown.filter((c) => !late.includes(c));
  const lateText = datesText("venceu", datesOf(late));
  const restText = datesText(rest.every((c) => dueVerb(c.dueDate, c.status) === "venceu") ? "venceu" : "vence", datesOf(rest));

  const parts: SubtitlePart[] = [];
  if (items.length > 0) parts.push({ text: items.join(" + ") });
  if (lateText) parts.push({ text: lateText, overdue: true });
  if (restText) parts.push({ text: restText });
  return parts;
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
  // So os meses anteriores a este (link "+ R$ X de meses anteriores" do Financeiro).
  const beforeParam = searchParams.get("before");
  const overdueBefore = allOverdue && beforeParam && /^\d{4}-\d{2}$/.test(beforeParam) ? beforeParam : null;

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
  const showAllOverdue = (on: boolean, before?: string) =>
    update({ overdue: on ? "all" : null, before: on && before ? before : null, month: null, status: null });
  const setStatusFilter = (next: StatusFilterValue) =>
    update({ status: next === "open" ? null : next });
  const setKindFilter = (next: "all" | ChargeKind) => update({ kind: next === "all" ? null : next });
  const clearFilters = () => update({ status: null, kind: null });

  return {
    competence,
    statusFilter,
    kindFilter,
    allOverdue,
    overdueBefore,
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
  const thisMonth = currentCompetence();
  const refMonthOf = (c: ChargeView) => c.competence ?? c.dueDate.slice(0, 7);
  const thisMonthCents = charges.filter((c) => refMonthOf(c) === thisMonth).reduce((s, c) => s + c.amountCents, 0);
  const earlierCents = charges.filter((c) => refMonthOf(c) < thisMonth).reduce((s, c) => s + c.amountCents, 0);
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-2xs",
        // Cartao neutro (10/11/2026): o vermelho fica so no valor.
        "border-border/70 bg-card",
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
          : !hasOverdue
            ? "Nenhuma cobrança em atraso"
            : thisMonthCents > 0 && earlierCents > 0
              ? // A composicao do total (11/11/2026): o cartao do Financeiro mostra so o do mes.
                `${formatCents(thisMonthCents)} de ${competenceLabel(thisMonth).replace(/ de \d{4}$/, "").toLowerCase()} · ${formatCents(earlierCents)} de meses anteriores`
              : `${plural(charges.length, "cobrança", "cobranças")} de ${plural(months, "mês", "meses")}`}
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
    overdueBefore,
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

  const chargesFilter = useMemo<ChargeFilter>(() => {
    const kind = kindFilter === "all" ? undefined : kindFilter;
    return allOverdue
      ? (kind ? { status: "overdue", kind } : { status: "overdue" })
      : (kind ? { competence, kind } : { competence });
  }, [allOverdue, kindFilter, competence]);

  const {
    data: charges,
    isLoading: chargesLoading,
    isError,
    refetch,
  } = useCharges(chargesFilter);
  const isCurrentMonth = !allOverdue && competence === currentCompetence();
  const overdueOnlyFilter = useMemo<ChargeFilter>(() => ({ status: "overdue" }), []);
  const { data: allOverdueCharges } = useCharges(overdueOnlyFilter, isCurrentMonth);
  const earlierOverdue = isCurrentMonth
    ? (allOverdueCharges ?? []).filter((c) => (c.competence ?? c.dueDate.slice(0, 7)) < competence)
    : [];
  const earlierOverdueCents = earlierOverdue.reduce((s, c) => s + c.amountCents, 0);
  const chargeActions = useChargeActions();
  // Espera a organizacao junto das cobrancas: senao "Cobrar online" pisca travado antes de destravar.
  const isLoading = chargesLoading || (!isError && chargeActions.isOrgPending);
  const { canManage, overRecurringLimit } = chargeActions;
  const withChargeContextMenu = chargeActions.withContextMenu;
  const renderChargeActions = chargeActions.renderActions;

  const refMonth = (c: ChargeView) => c.competence ?? c.dueDate.slice(0, 7);
  const list = overdueBefore ? (charges ?? []).filter((c) => refMonth(c) < overdueBefore) : (charges ?? []);
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

  // Todos os atrasos: por mes (mais recente primeiro) e, dentro dele, por aluno,
  // com um subtitulo "Novembro de 2026 · R$ 4.525,53" (11/11/2026).
  const groupMonth = new Map<StudentConsolidatedGroup, string>();
  const monthTotals = new Map<string, number>();
  let studentGroups: StudentConsolidatedGroup[];
  if (allOverdue) {
    const months = [...new Set(filteredList.map(refMonth))].sort().reverse();
    studentGroups = months.flatMap((month) => {
      const ofMonth = filteredList.filter((c) => refMonth(c) === month);
      monthTotals.set(month, ofMonth.reduce((sum, c) => sum + c.amountCents, 0));
      const groups = groupByStudent(ofMonth);
      for (const g of groups) groupMonth.set(g, month);
      return groups;
    });
  } else {
    studentGroups = groupByStudent(filteredList);
  }
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
    // No lugar do seletor de situacao, que repetia as abas (11/11/2026).
    { id: "all", label: "Todas", count: searchMatchedList.filter((c) => matchesStatusFilter(c, "all")).length },
  ];
  // Filtro fino que veio por link (pendentes, canceladas, isentas, substituidas): sem aba, vira um aviso.
  const offTabFilter = quickTabs.some((t) => t.id === statusFilter)
    ? undefined
    : STATUS_FILTERS.find((f) => f.value === statusFilter)?.label;

  // Link do cartao (11/11/2026): aplica o filtro, marca o cartao e rola ate a
  // lista, para a mudanca ser vista; clicar de novo volta para "A receber".
  const scrollToList = () => {
    window.requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("billing-list")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  };
  const cardFilterAction = (label: string, value: StatusFilterValue) =>
    statusFilter === value
      ? { label: "Limpar filtro", onClick: () => setStatusFilter("open") }
      : {
          label,
          onClick: () => {
            setStatusFilter(value);
            scrollToList();
          },
        };

  const isFutureCompetence = competence > dateInSpace().slice(0, 7);

  return (
    <>
      <PageHeader
        title="Cobranças"
        description={
          allOverdue
            ? overdueBefore
              ? `Cobranças em atraso de antes de ${competenceLabel(overdueBefore).toLowerCase()}.`
              : "Cobranças em atraso de todos os meses, até hoje."
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
              /* Indicadores do mes: o mesmo cartao do Financeiro (StatCard). */
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total ativo"
                  icon={<Wallet />}
                  isLoading={isLoading}
                  value={formatCents(activeTotalCents)}
                  sub={
                    waivedCount > 0
                      ? `${plural(activeList.length, "ativa", "ativas")} · ${plural(waivedCount, "isenta", "isentas")}`
                      : plural(activeList.length, "ativa", "ativas")
                  }
                  active={statusFilter === "all"}
                  action={cardFilterAction("Ver todas", "all")}
                />
                <StatCard
                  label="Recebido"
                  icon={<CheckCircle2 />}
                  iconTone="success"
                  valueTone="success"
                  isLoading={isLoading}
                  value={formatCents(paidCents)}
                  sub={plural(paidList.length, "paga", "pagas")}
                  active={statusFilter === "paid"}
                  action={cardFilterAction("Ver pagas", "paid")}
                />
                <StatCard
                  label="Em atraso"
                  icon={<AlertCircle />}
                  iconTone={!isLoading && overdueList.length > 0 ? "danger" : "neutral"}
                  valueTone={overdueList.length > 0 ? "danger" : "neutral"}
                  isLoading={isLoading}
                  value={formatCents(overdueCents)}
                  sub={`${overdueList.length} em atraso`}
                  active={statusFilter === "overdue"}
                  action={cardFilterAction("Ver atrasadas", "overdue")}
                />
                <StatCard
                  label={
                    <span className="flex flex-wrap items-center gap-1.5">
                      Cancelado
                      {!isLoading && canceledList.length > 0 ? (
                        <span className="hidden items-center rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 sm:inline-flex">
                          Não cobrado
                        </span>
                      ) : null}
                    </span>
                  }
                  icon={<Ban />}
                  iconTone={!isLoading && canceledList.length > 0 ? "warning" : "neutral"}
                  valueTone={canceledList.length > 0 ? "warning" : "muted"}
                  isLoading={isLoading}
                  value={formatCents(canceledCents)}
                  sub={plural(canceledList.length, "cancelada", "canceladas")}
                  active={statusFilter === "canceled"}
                  action={cardFilterAction("Ver canceladas", "canceled")}
                />
            </div>
          ))}

          {earlierOverdue.length > 0 ? (
            // Aviso neutro (10/11/2026): cartao comum, vermelho so no icone e no valor.
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-2xs">
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
              {/* O aviso fala dos meses anteriores: abre so eles (11/11/2026). */}
              <Button variant="outline" onClick={() => showAllOverdue(true, competence)}>
                Ver atrasos anteriores
              </Button>
            </div>
          ) : null}

          {/* Busca + filtros (ancora: os links dos cartoes rolam ate aqui) */}
          <div id="billing-list" className="flex scroll-mt-20 flex-col gap-2 lg:flex-row lg:items-center">
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
                {offTabFilter ? <span className="font-medium text-foreground">Mostrando: {offTabFilter}</span> : null}
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
              paginatedStudentGroups.map((group, index) => {
                const month = groupMonth.get(group);
                const previousMonth = index > 0 ? groupMonth.get(paginatedStudentGroups[index - 1]!) : undefined;
                const row = ((group: StudentConsolidatedGroup) => {
                // Caso 1: Aluno com 1 única cobrança na visão atual -> linha direta e limpa
                if (group.charges.length === 1) {
                  const c = group.charges[0]!;
                  return withChargeContextMenu(
                    c,
                    <ListRow
                      key={c.id}
                      data-record-id={c.studentId}
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
                            {c.status === "waived" || statusRepeatsTab(statusLabelOf(c), statusFilter) ? null : <ChargeStatusBadge charge={c} />}
                            <PaidViaBadge charge={c} />
                            <ScholarshipBadge charge={c} />
                            <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                            <WhatsAppSentBadge charge={c} />
                          </div>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {renderSubtitle(cleanSingleSubtitle(c))}
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
                    data-record-id={group.studentId}
                    className="relative border-b border-border/60 transition-colors last:border-b-0"
                  >
                    {/* Aberto: a barra fina a esquerda, como os grupos de Lembretes e a ficha do aluno (doc 07 §1.8). */}
                    <SectionBar visible={isExpanded} />
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
                              {statusRepeatsTab(badge.label, statusFilter) ? null : (
                                <span
                                  className={cn(
                                    "status-dot inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                                    badge.className,
                                  )}
                                >
                                  {badge.label}
                                </span>
                              )}
                            </div>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {renderSubtitle(cleanGroupSubtitle(group))}
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
                                  <span className="text-overdue">
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
                                      {/* Vencida: "venceu 04/11 · 7 dias" em vermelho, como na linha simples. */}
                                      ·{" "}
                                      {c.status === "overdue" ? (
                                        <span className="text-overdue">{duePart(c).text}</span>
                                      ) : c.kind === "dropin" ? (
                                        `aula em ${shortDate(c.dueDate)}`
                                      ) : (
                                        `${dueVerb(c.dueDate, c.status)} ${shortDate(c.dueDate)}`
                                      )}
                                      {c.status === "paid" && c.method ? ` · ${paymentMethodLabel(c.method)}` : ""}
                                      {c.onlineOpenedAt && (c.status === "pending" || c.status === "overdue") ? " · link aberto" : ""}
                                    </span>
                                    {c.status === "waived" || statusRepeatsTab(statusLabelOf(c), statusFilter) ? null : (
                                      <ChargeStatusBadge charge={c} size="sm" />
                                    )}
                                    <PaidViaBadge charge={c} />
                                    <ScholarshipBadge charge={c} />
                                    <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                                    <WhatsAppSentBadge charge={c} size="sm" />
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
                })(group);
                if (!month) return row;
                return (
                  <Fragment key={`${month}:${group.studentId}`}>
                    {month !== previousMonth ? (
                      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-5">
                        <span>{competenceLabel(month)}</span>
                        <span className="tabular-nums">{formatCents(monthTotals.get(month) ?? 0)}</span>
                      </div>
                    ) : null}
                    {row}
                  </Fragment>
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
