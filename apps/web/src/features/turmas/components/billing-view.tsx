"use client";

import { useState, useSyncExternalStore } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
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
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { paymentMethodLabel } from "@/lib/labels";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type {
  ChargeKind,
  ChargeStatus,
  ChargeView,
  PaymentMethod,
  PlanPeriod,
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
import { RegisterPaymentDialog } from "./register-payment-dialog";

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

function groupCharges(charges: ChargeView[]): StudentBillingGroup[] {
  const map = new Map<string, StudentBillingGroup>();

  for (const c of charges) {
    const isMembership = c.kind === "membership";
    const key = isMembership ? `${c.studentId}_${c.planId ?? ""}` : c.id;

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

const PERIOD_UNIT: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

const PERIOD_NAME: Record<PlanPeriod, string> = {
  monthly: "Mensal",
  biweekly: "Quinzenal",
  weekly: "Semanal",
};

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

/** Cancelada pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre. */
const SYSTEM_CANCELED_HINT =
  "Cancelada automaticamente pelo sistema (troca de plano ou de regra, inativação ou saída da aula). Não pode ser reaberta.";
const isSystemCanceled = (c: ChargeView) => c.canceledBy === "system";

/** "2026-09" -> "Setembro de 2026". */
function competenceLabel(competence: string): string {
  const label = format(parseISO(`${competence}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Periodo de uso que a cobranca paga, quando conhecido ("01/10 a 31/10"). */
function referenceLabel(c: ChargeView): string | null {
  return c.periodStart && c.periodEnd ? `${shortDate(c.periodStart)} a ${shortDate(c.periodEnd)}` : null;
}

function getCycleTitle(c: ChargeView): string {
  if (c.isProrated) {
    return c.proratedDays ? `Proporcional (${c.proratedDays} dias)` : "Proporcional";
  }
  const ref = referenceLabel(c);
  if (ref && c.planPeriod && c.planPeriod !== "monthly") return ref;
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

  const {
    data: charges,
    isLoading,
    isError,
    refetch,
  } = useCharges({
    competence,
    kind: kindFilter === "all" ? undefined : kindFilter,
  });
  // O reset atua so nas mensalidades da competencia, qualquer que seja o filtro.
  const { data: competenceMemberships } = useCharges({ competence, kind: "membership" });

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

  const generate = async () => {
    const ok = await confirmAction({
      title: `Gerar cobranças de ${competenceLabel(competence)}?`,
      description:
        "Cria as mensalidades que vencem neste mês para os alunos ativos, pela regra de cobrança de cada um. Cobranças já existentes não são duplicadas.",
      confirmLabel: "Gerar cobranças",
    });
    if (!ok) return;
    generateMut.mutate(competence, {
      onSuccess: (r) =>
        toast.success(
          r.created > 0
            ? `${plural(r.created, "cobrança gerada", "cobranças geradas")}.`
            : "Nenhuma cobrança nova (já geradas).",
        ),
      onError: (err) =>
        toast.error(getErrorMessage(err, "Não foi possível gerar as cobranças.")),
    });
  };

  const shiftCompetence = (delta: number) =>
    setCompetence((prev) => format(addMonths(parseISO(`${prev}-01`), delta), "yyyy-MM"));

  const [chargeToPay, setChargeToPay] = useState<ChargeView | null>(null);
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  const pay = (c: ChargeView, method: PaymentMethod) =>
    paidMut.mutate(
      { id: c.id, method },
      {
        onSuccess: () => {
          toast.success(`Pagamento registrado (${paymentMethodLabel(method)}).`);
          setChargeToPay(null);
        },
        onError: (err) =>
          toast.error(getErrorMessage(err, "Não foi possível registrar o pagamento.")),
      },
    );

  const undoPayment = async (c: ChargeView) => {
    const ok = await confirmAction({
      title: "Desfazer pagamento?",
      description: `A cobrança de ${c.studentName} (${formatCents(c.amountCents)}) volta a ficar em aberto${c.method ? ` e o registro via ${paymentMethodLabel(c.method)} é apagado` : ""}.`,
      confirmLabel: "Desfazer pagamento",
      variant: "destructive",
    });
    if (!ok) return;
    pendingMut.mutate(c.id, {
      onSuccess: () => toast.success("Pagamento desfeito."),
      onError: (err) =>
        toast.error(getErrorMessage(err, "Não foi possível desfazer o pagamento.")),
    });
  };

  const revertCancel = async (c: ChargeView) => {
    const ok = await confirmAction({
      title: "Reabrir cobrança?",
      description: `A cobrança de ${c.studentName} (${formatCents(c.amountCents)}) volta a compor o total a receber.`,
      confirmLabel: "Reabrir cobrança",
    });
    if (!ok) return;
    revertMut.mutate(c.id, {
      onSuccess: () => toast.success("Cobrança reaberta."),
      onError: (err) =>
        toast.error(getErrorMessage(err, "Não foi possível reabrir a cobrança.")),
    });
  };

  const [confirmClear, setConfirmClear] = useState(false);
  // Mesmo conjunto que o reset remove: mensalidades em aberto ou canceladas.
  const resetCount = (competenceMemberships ?? []).filter((c) => c.status !== "paid").length;

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
                onClick={() => setConfirmClear(true)}
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
                  {isLoading ? "—" : plural(activeList.length, "ativa", "ativas")}
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
                  {isLoading ? "—" : plural(canceledList.length, "cancelada", "canceladas")}
                </p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Competência</span>
                <div className="inline-flex items-center rounded-md border border-border/70 bg-background">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-9 rounded-r-none"
                    aria-label="Competência anterior"
                    onClick={() => shiftCompetence(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span
                    className="min-w-36 px-2 text-center font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {competenceLabel(competence)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-9 rounded-l-none"
                    aria-label="Próxima competência"
                    onClick={() => shiftCompetence(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

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
              !isLoading && isError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar as cobranças. Tente novamente.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RotateCw className="size-4" />
                    Tentar novamente
                  </Button>
                </div>
              ) : !isLoading && groups.length === 0 ? (
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
                        className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-nowrap sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 basis-full items-center gap-3.5 sm:basis-0">
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
                                {group.planPeriod ? PERIOD_NAME[group.planPeriod] : "Parcelas"}
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
                                      isSystemCanceled(c) ? (
                                        <span title={SYSTEM_CANCELED_HINT} className="inline-flex">
                                          <Button variant="outline" size="xs" disabled>
                                            <RotateCcw className="size-3.5" />
                                            Reverter
                                          </Button>
                                        </span>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="xs"
                                          disabled={revertMut.isPending}
                                          onClick={() => revertCancel(c)}
                                          title="Reverter cancelamento"
                                        >
                                          <RotateCcw className="size-3.5" />
                                          Reverter
                                        </Button>
                                      )
                                    ) : c.status === "paid" ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="size-7"
                                        title="Desfazer pagamento"
                                        onClick={() => undoPayment(c)}
                                      >
                                        <RotateCcw className="size-3.5" />
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="xs"
                                          onClick={() => setChargeToPay(c)}
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
                    // No celular, valor e ações descem para baixo do texto.
                    className="flex-wrap gap-y-2 sm:flex-nowrap [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0 [&>div:last-child]:ml-auto"
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
                            isSystemCanceled(c) ? (
                              <span title={SYSTEM_CANCELED_HINT} className="inline-flex">
                                <Button variant="outline" size="sm" disabled>
                                  <RotateCcw className="size-4" />
                                  Reverter
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={revertMut.isPending}
                                onClick={() => revertCancel(c)}
                                title="Reverter cancelamento"
                              >
                                <RotateCcw className="size-4" />
                                Reverter
                              </Button>
                            )
                          ) : c.status === "paid" ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-8"
                              title="Desfazer pagamento"
                              onClick={() => undoPayment(c)}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setChargeToPay(c)}
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
                              ? `aula em ${shortDate(c.dueDate)}`
                              : `vence ${shortDate(c.dueDate)}`}
                          </span>
                          {c.kind === "membership" && referenceLabel(c) ? (
                            <>
                              <span>·</span>
                              <span>referente a {referenceLabel(c)}</span>
                            </>
                          ) : null}
                          {c.status === "paid" && c.method ? (
                            <>
                              <span>·</span>
                              <span>pago via {paymentMethodLabel(c.method)}</span>
                            </>
                          ) : null}
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

      {confirmDialog}
      <RegisterPaymentDialog
        charge={chargeToPay}
        isPending={paidMut.isPending}
        onOpenChange={(open) => {
          if (!open) setChargeToPay(null);
        }}
        onConfirm={(method) => chargeToPay && pay(chargeToPay, method)}
      />

      {/* Confirmação do reset: pagas nunca são apagadas */}
      <ConfirmActionDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Resetar cobranças da competência"
        description={
          <>
            Remove{" "}
            {resetCount === 1 ? "a " : "as "}
            <strong className="text-foreground">
              {plural(resetCount, "mensalidade em aberto ou cancelada", "mensalidades em aberto ou canceladas")}
            </strong>{" "}
            desta competência para gerar de novo. Mensalidades pagas e aulas avulsas são mantidas.
          </>
        }
        confirmLabel="Resetar cobranças"
        cancelLabel="Voltar"
        variant="destructive"
        isPending={clearMut.isPending}
        onConfirm={async () => {
          try {
            const r = await clearMut.mutateAsync(competence);
            toast.success(
              r.deleted > 0
                ? `${plural(r.deleted, "mensalidade removida", "mensalidades removidas")}${r.keptPaid > 0 ? `, ${plural(r.keptPaid, "paga mantida", "pagas mantidas")}` : ""}.`
                : "Nenhuma mensalidade em aberto para remover.",
            );
            setConfirmClear(false);
          } catch (err) {
            toast.error(getErrorMessage(err, "Não foi possível resetar as cobranças."));
          }
        }}
      />

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
          try {
            await cancelMut.mutateAsync(chargeToCancel.id);
            toast.success("Cobrança cancelada com sucesso.");
            setChargeToCancel(null);
          } catch (err) {
            toast.error(getErrorMessage(err, "Não foi possível cancelar a cobrança."));
          }
        }}
      />
    </>
  );
}
