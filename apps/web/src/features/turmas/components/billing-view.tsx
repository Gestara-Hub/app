"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Info,
  Lock,
  QrCode,
  RotateCcw,
  RotateCw,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { ListItemActionsMenu } from "@/components/shared/list-item-actions-menu";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { paymentMethodLabel } from "@/lib/labels";
import { normalizeText } from "@/lib/text";
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
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import {
  useCancelCharge,
  useCharges,
  useMarkChargePaid,
  useMarkChargePending,
  useActiveRecurringAuthorizations,
  useRevertCharge,
} from "../hooks/use-billing";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { OnlineChargeDialog } from "./online-charge-dialog";

const STATUS_LABEL: Record<ChargeStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
  waived: "Isento",
};

const STATUS_CLASS: Record<ChargeStatus, string> = {
  pending: "border-border/60 bg-muted/50 text-muted-foreground",
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  canceled: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 line-through",
  waived: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
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

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

/** Cancelada pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre. */
const SYSTEM_CANCELED_HINT =
  "Cancelada automaticamente pelo sistema (troca de plano ou de regra, inativação ou saída da aula). Não pode ser reaberta.";
const isSystemCanceled = (c: ChargeView) => c.canceledBy === "system";

/** D8: pago online ou por Pix Automatico nao se desfaz (seria estorno). */
const isPaidOnline = (c: ChargeView) =>
  c.status === "paid" && (c.paidVia === "online" || c.paidVia === "recurring");
const PAID_ONLINE_HINT =
  "Pago online: não pode ser desfeito, porque seria um estorno (não existe nesta versão).";
const PAID_RECURRING_HINT =
  "Pago pelo Pix Automático: não pode ser desfeito, porque seria um estorno (não existe nesta versão).";

/** Selo de como a cobranca paga foi recebida (so online / Pix Automatico). */
function PaidViaBadge({ charge }: { charge: ChargeView }) {
  if (charge.status !== "paid") return null;
  if (charge.paidVia !== "online" && charge.paidVia !== "recurring") return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] leading-none font-medium text-primary">
      {charge.paidVia === "online" ? "Pago online" : "Pix Automático"}
    </span>
  );
}

/** Selo de bolsa: "Bolsista" (integral) ou "Bolsa 50%" (parcial). */
function ScholarshipBadge({ charge }: { charge: ChargeView }) {
  // Isento so existe por bolsa integral (dados antigos podem nao ter a %).
  const percent = charge.scholarshipPercent ?? (charge.status === "waived" ? 100 : undefined);
  if (percent === undefined || charge.status === "canceled") return null;
  const full = percent >= 100;
  return (
    <span
      title={
        charge.listAmountCents !== undefined
          ? `Valor do plano: ${formatCents(charge.listAmountCents)}`
          : undefined
      }
      className="inline-flex shrink-0 items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] leading-none font-medium text-sky-700 dark:text-sky-300"
    >
      {full ? "Bolsista" : `Bolsa ${percent}%`}
    </span>
  );
}

/** Valor da cobranca; com bolsa, mostra antes o valor cheio riscado. */
function ChargeAmount({ charge, className }: { charge: ChargeView; className: string }) {
  const showList =
    charge.status !== "canceled" &&
    charge.listAmountCents !== undefined &&
    charge.listAmountCents > charge.amountCents;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {showList ? (
        <span className="text-[11px] tabular-nums text-muted-foreground line-through">
          {formatCents(charge.listAmountCents ?? 0)}
        </span>
      ) : null}
      <span
        className={cn(
          className,
          charge.status === "canceled" ? "text-muted-foreground/60 line-through" : "text-foreground",
        )}
      >
        {formatCents(charge.amountCents)}
      </span>
    </span>
  );
}

/** Aviso: aluno com Pix Automatico ativo, mas a cobranca passa do limite. */
function RecurringLimitBadge({ limitCents }: { limitCents?: number }) {
  if (limitCents === undefined) return null;
  return (
    <span
      title={`O Pix Automático deste aluno tem limite de ${formatCents(limitCents)} por cobrança. Esta fica em aberto: cobre de outra forma ou aumente o limite no cadastro do aluno.`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] leading-none font-medium text-warning"
    >
      <AlertCircle className="size-3" aria-hidden />
      Acima do limite do Pix Automático
    </span>
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

const STATUS_FILTERS: { value: "all" | ChargeStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasadas" },
  { value: "paid", label: "Pagas" },
  { value: "canceled", label: "Canceladas" },
  { value: "waived", label: "Isentas" },
];

function isChargeStatus(value: string | null): value is ChargeStatus {
  return (
    value === "pending" ||
    value === "overdue" ||
    value === "paid" ||
    value === "canceled" ||
    value === "waived"
  );
}

function isChargeKind(value: string | null): value is ChargeKind {
  return value === "membership" || value === "dropin";
}

const currentCompetence = () => format(new Date(), "yyyy-MM");

/**
 * Filtros na URL (o Financeiro linka para ca): `?month=YYYY-MM`,
 * `?status=overdue|pending|paid|canceled` e `?kind=membership|dropin`. Padroes
 * (mes atual, todos) ficam fora da URL. Mesmo padrao do calendario de turmas.
 */
function useBillingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get("month");
  const competence =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentCompetence();
  const statusParam = searchParams.get("status");
  const statusFilter: "all" | ChargeStatus = isChargeStatus(statusParam) ? statusParam : "all";
  const kindParam = searchParams.get("kind");
  const kindFilter: "all" | ChargeKind = isChargeKind(kindParam) ? kindParam : "all";

  const update = (patch: Record<string, string | null>) => {
    // Parte da URL atual (nao do snapshot do render): duas trocas seguidas
    // antes do re-render nao se apagam.
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setCompetence = (next: string) =>
    update({ month: next === currentCompetence() ? null : next });
  const setStatusFilter = (next: "all" | ChargeStatus) =>
    update({ status: next === "all" ? null : next });
  const setKindFilter = (next: "all" | ChargeKind) => update({ kind: next === "all" ? null : next });

  return { competence, statusFilter, kindFilter, setCompetence, setStatusFilter, setKindFilter };
}

export function BillingView() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { competence, statusFilter, kindFilter, setCompetence, setStatusFilter, setKindFilter } =
    useBillingFilters();
  const [chargeToCancel, setChargeToCancel] = useState<ChargeView | null>(null);
  const [search, setSearch] = useState("");
  // Conteudo do confirm com o ultimo valor: nao some durante a animacao de saida.
  const shownChargeToCancel = useRetainedValue(chargeToCancel);
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
  const paidMut = useMarkChargePaid();
  const pendingMut = useMarkChargePending();
  const cancelMut = useCancelCharge();
  const revertMut = useRevertCharge();

  const can = useCan();
  const canManage = can("billing:manage");

  // Cobrar online: billing:manage + recurso do plano + opcao ligada.
  const hasFeature = useHasFeature();
  const hasOnlineFeature = hasFeature("online_payments");
  const { data: org } = useOrganization();
  const onlineEnabled = Boolean(org?.settings?.onlinePayments?.enabled);
  const onlineBlockedReason = !hasOnlineFeature
    ? "Plano Pro"
    : !onlineEnabled
      ? "desligado nas Configurações"
      : null;
  const [chargeToCollect, setChargeToCollect] = useState<ChargeView | null>(null);

  // Limite do Pix Automatico por aluno (so autorizacoes ativas).
  const { data: activeRecurring } = useActiveRecurringAuthorizations(hasOnlineFeature);
  const recurringLimit = new Map((activeRecurring ?? []).map((a) => [a.studentId, a.maxAmountCents]));
  const overRecurringLimit = (c: ChargeView): number | undefined => {
    if (c.kind !== "membership" || (c.status !== "pending" && c.status !== "overdue")) return undefined;
    const limit = recurringLimit.get(c.studentId);
    return limit !== undefined && c.amountCents > limit ? limit : undefined;
  };

  const list = charges ?? [];
  // Status e busca filtram so a lista; os cartoes seguem mostrando o mes inteiro.
  const query = normalizeText(search);
  const filteredList = list.filter(
    (c) =>
      (statusFilter === "all" || c.status === statusFilter) &&
      (query === "" || normalizeText(c.studentName).includes(query)),
  );
  const groups = groupCharges(filteredList);
  const hasListFilters = statusFilter !== "all" || kindFilter !== "all" || query !== "";
  const clearListFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKindFilter("all");
  };

  // Isentas (bolsa integral) nao entram nos totais: R$ 0 e nada a receber.
  const activeList = list.filter((c) => c.status !== "canceled" && c.status !== "waived");
  const activeTotalCents = activeList.reduce((s, c) => s + c.amountCents, 0);

  const waivedCount = list.filter((c) => c.status === "waived").length;

  const paidList = list.filter((c) => c.status === "paid");
  const paidCents = paidList.reduce((s, c) => s + c.amountCents, 0);

  const overdueList = list.filter((c) => c.status === "overdue");
  const overdueCents = overdueList.reduce((s, c) => s + c.amountCents, 0);

  const canceledList = list.filter((c) => c.status === "canceled");
  const canceledCents = canceledList.reduce((s, c) => s + c.amountCents, 0);

  const shiftCompetence = (delta: number) =>
    setCompetence(format(addMonths(parseISO(`${competence}-01`), delta), "yyyy-MM"));

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

  // Acoes da linha (compact = sub-parcela dentro do painel expandido).
  const renderChargeActions = (c: ChargeView, compact: boolean) => {
    if (!canManage) return null;
    const btnSize = compact ? "xs" : "sm";
    const iconCls = compact ? "size-3.5" : "size-4";

    // Isento (bolsa integral): nada a pagar, cobrar ou cancelar.
    if (c.status === "waived") return null;

    if (c.status === "canceled") {
      return isSystemCanceled(c) ? (
        <span title={SYSTEM_CANCELED_HINT} className="inline-flex">
          <Button variant="outline" size={btnSize} disabled>
            <RotateCcw className={iconCls} />
            Reverter
          </Button>
        </span>
      ) : (
        <Button
          variant="outline"
          size={btnSize}
          disabled={revertMut.isPending}
          onClick={() => revertCancel(c)}
          title="Reverter cancelamento"
        >
          <RotateCcw className={iconCls} />
          Reverter
        </Button>
      );
    }

    if (c.status === "paid") {
      if (isPaidOnline(c)) {
        const hint = c.paidVia === "recurring" ? PAID_RECURRING_HINT : PAID_ONLINE_HINT;
        return (
          <span
            title={hint}
            aria-label={hint}
            role="img"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground",
              compact ? "size-7" : "size-8",
            )}
          >
            <Info className={iconCls} />
          </span>
        );
      }
      return (
        <Button
          variant="ghost"
          size={compact ? "icon-xs" : "icon-sm"}
          className={compact ? "size-7" : "size-8"}
          title="Desfazer pagamento"
          onClick={() => undoPayment(c)}
        >
          <RotateCcw className={iconCls} />
        </Button>
      );
    }

    return (
      <ListItemActionsMenu
        title="Mais opções"
        ariaLabel={`Ações de ${c.studentName}`}
        variant="ghost"
        actions={[
          {
            key: "pay",
            label: "Marcar pago",
            icon: <CheckCircle2 className="size-4" />,
            onSelect: () => setChargeToPay(c),
          },
          {
            key: "online",
            label: onlineBlockedReason ? `Cobrar online (${onlineBlockedReason})` : "Cobrar online",
            icon: onlineBlockedReason ? <Lock className="size-4" /> : <QrCode className="size-4" />,
            disabled: Boolean(onlineBlockedReason),
            onSelect: () => setChargeToCollect(c),
          },
          {
            key: "cancel",
            label: "Cancelar cobrança",
            icon: <Ban className="size-4" />,
            destructive: true,
            onSelect: () => setChargeToCancel(c),
          },
        ]}
      />
    );
  };

  // Mensalidades nascem sozinhas no mes atual; meses futuros aparecem quando chegarem.
  const isFutureCompetence = competence > format(new Date(), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Mensalidades"
        description="Cobranças por competência (mês). As mensalidades do mês são geradas automaticamente."
      />

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

          {/* Busca por aluno */}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar aluno..."
            aria-label="Buscar aluno"
          />

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

              <div
                role="group"
                aria-label="Filtrar por situação"
                className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs"
              >
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={statusFilter === f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1 font-medium transition-colors",
                      statusFilter === f.value
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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
              ) : !isLoading && groups.length === 0 && list.length > 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {query !== ""
                      ? `Nenhuma cobrança de “${search.trim()}” com estes filtros no mês.`
                      : "Nenhuma cobrança com esta situação no mês."}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearListFilters}>
                    Limpar filtros
                  </Button>
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
                        <ChargeAmount charge={c} className="text-sm font-medium tabular-nums" />

                        {renderChargeActions(c, false)}
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
                          {/* So a aula avulsa tem selo de tipo; mensalidade e o padrao da tela. */}
                          {c.kind === "dropin" ? (
                            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Aula Avulsa
                            </span>
                          ) : null}
                          {c.status === "waived" ? null : (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                                STATUS_CLASS[c.status],
                              )}
                            >
                              {STATUS_LABEL[c.status]}
                            </span>
                          )}
                          <PaidViaBadge charge={c} />
                          <ScholarshipBadge charge={c} />
                          <RecurringLimitBadge limitCents={overRecurringLimit(c)} />
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                          {c.className ? <span>{c.className}</span> : null}
                          {c.className && c.planName ? <span>·</span> : null}
                          {c.planName ? <span>{c.planName}</span> : null}
                          {c.planPeriod && c.planPeriod !== "monthly" ? (
                            <>
                              <span>·</span>
                              <span>cobrança por {PERIOD_UNIT[c.planPeriod]}</span>
                            </>
                          ) : null}
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
                              <span>
                                {c.paidVia === "online" ? "pago online via " : "pago via "}
                                {paymentMethodLabel(c.method)}
                              </span>
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
      <OnlineChargeDialog
        charge={chargeToCollect}
        onOpenChange={(open) => {
          if (!open) setChargeToCollect(null);
        }}
      />
      <RegisterPaymentDialog
        charge={chargeToPay}
        isPending={paidMut.isPending}
        onOpenChange={(open) => {
          if (!open) setChargeToPay(null);
        }}
        onConfirm={(method) => chargeToPay && pay(chargeToPay, method)}
      />

      {/* Confirmação de cancelamento da cobrança */}
      <ConfirmActionDialog
        open={chargeToCancel !== null}
        onOpenChange={(open) => {
          if (!open) setChargeToCancel(null);
        }}
        title="Cancelar cobrança"
        description={
          shownChargeToCancel ? (
            <>
              Deseja realmente cancelar a cobrança de{" "}
              <strong className="text-foreground">
                {shownChargeToCancel.studentName}
              </strong>
              {getCycleTitle(shownChargeToCancel) !== "Mensalidade" ? (
                <> ({getCycleTitle(shownChargeToCancel)})</>
              ) : null}{" "}
              no valor de{" "}
              <strong className="text-foreground">
                {formatCents(shownChargeToCancel.amountCents)}
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
