"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  Tags,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type {
  FinanceEntryView,
  FinancialEntryDisplayStatus,
  FinancialEntryFilter,
  FinancialEntryType,
  PaymentMethod,
} from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { financialEntryStatusLabel, paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import {
  useCancelFinanceEntry,
  useDeleteFinanceEntry,
  useEndFinanceRecurrence,
  useFinanceEntries,
  useFinancialCategories,
  useMarkFinanceEntryPaid,
  useMarkFinanceEntryPending,
} from "../hooks/use-finance";
import { competenceLabel, financeHref } from "../lib";
import { ENTRY_STATUS_CLASS, billingHref, fullDate, shortDate } from "../finance-ui";
import { FinanceEntryFormDialog } from "./finance-entry-form-dialog";
import { FinancePaymentDialog } from "./finance-payment-dialog";
import { FinancialCategoryManagerDialog } from "./financial-category-manager-dialog";

type TypeFilter = "all" | FinancialEntryType;
type StatusFilter = "all" | FinancialEntryDisplayStatus;

const TYPE_FILTER_LABEL: Record<TypeFilter, string> = {
  all: "Todos os tipos",
  income: "Entradas",
  expense: "Saídas",
};

const STATUS_FILTERS: StatusFilter[] = ["all", "paid", "pending", "overdue", "canceled"];

function statusFilterLabel(value: StatusFilter): string {
  return value === "all" ? "Todos os status" : financialEntryStatusLabel(value);
}

function StatusBadge({ status }: { status: FinancialEntryDisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ENTRY_STATUS_CLASS[status],
      )}
    >
      {financialEntryStatusLabel(status)}
    </span>
  );
}

/** "42 pagas · 5 pendentes · 2 atrasadas" do agregado de cobrancas. */
function chargeCountsLabel(counts: NonNullable<FinanceEntryView["chargeCounts"]>): string {
  const parts: string[] = [];
  if (counts.paid > 0) parts.push(plural(counts.paid, "paga", "pagas"));
  if (counts.pending > 0) parts.push(plural(counts.pending, "pendente", "pendentes"));
  if (counts.overdue > 0) parts.push(plural(counts.overdue, "atrasada", "atrasadas"));
  return parts.join(" · ");
}

/** Kind da linha agregada ("charges:<kind>:<competence>"). */
function chargeKindOf(row: FinanceEntryView): "membership" | "dropin" {
  return row.id.split(":")[1] === "dropin" ? "dropin" : "membership";
}

function EntriesSkeleton() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  ));
}

/**
 * Lancamentos do mes: entradas e saidas unificadas (cobrancas dos alunos
 * agregadas, D7), filtros, novo lancamento e acoes da linha (docs/technical/05, 7.2).
 */
export function FinanceEntriesTab({
  competence,
  onCreateEntry,
}: {
  competence: string;
  onCreateEntry?: () => void;
}) {
  const can = useCan();
  const canManage = can("finance:manage");

  // Filtro inicial vindo de um link (ex.: "Ver contas atrasadas" do Resumo).
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const value = searchParams.get("type");
    return value === "income" || value === "expense" ? value : "all";
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get("status") as StatusFilter | null;
    return value && STATUS_FILTERS.includes(value) ? value : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filter: FinancialEntryFilter = {
    competence,
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(categoryFilter !== "all" ? { categoryId: categoryFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data, isPending, isError, refetch, isFetching } = useFinanceEntries(filter);
  const { data: categories } = useFinancialCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntryView | null>(null);
  const [paying, setPaying] = useState<FinanceEntryView | null>(null);
  const [categoryType, setCategoryType] = useState<FinancialEntryType>("expense");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmAction();

  const paidMut = useMarkFinanceEntryPaid();
  const pendingMut = useMarkFinanceEntryPending();
  const cancelMut = useCancelFinanceEntry();
  const deleteMut = useDeleteFinanceEntry();
  const endMut = useEndFinanceRecurrence();

  const rows = data ?? [];
  const hasSearch = search.trim().length > 0;
  const hasFilters = typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all";
  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const categoryOptions = (categories ?? []).filter(
    (c) => typeFilter === "all" || c.type === typeFilter,
  );
  const incomeCategories = categoryOptions.filter((c) => c.type === "income");
  const expenseCategories = categoryOptions.filter((c) => c.type === "expense");
  const selectedCategoryName =
    categoryFilter === "all"
      ? "Todas as categorias"
      : (categories ?? []).find((c) => c.id === categoryFilter)?.name ?? "Categoria";

  const active = rows.filter((r) => r.status !== "canceled");
  const incomeTotal = active.filter((r) => r.type === "income").reduce((s, r) => s + r.amountCents, 0);
  const expenseTotal = active.filter((r) => r.type === "expense").reduce((s, r) => s + r.amountCents, 0);

  const openCreate = () => {
    if (onCreateEntry) {
      onCreateEntry();
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  // --- Acoes (todas com dinheiro confirmam) -------------------------------

  const pay = (row: FinanceEntryView, method: PaymentMethod) =>
    paidMut.mutate(
      { id: row.id, method },
      {
        onSuccess: () => {
          toast.success(`Pagamento registrado (${paymentMethodLabel(method)}).`);
          setPaying(null);
        },
        onError: (err) => toast.error(getErrorMessage(err, "Não foi possível registrar o pagamento.")),
      },
    );

  const undoPayment = async (row: FinanceEntryView) => {
    const ok = await confirm({
      title: "Desfazer pagamento?",
      description: `“${row.description}” (${formatCents(row.amountCents)}) volta a ficar em aberto${row.method ? ` e o registro via ${paymentMethodLabel(row.method)} é apagado` : ""}.`,
      confirmLabel: "Desfazer pagamento",
      variant: "destructive",
    });
    if (!ok) return;
    pendingMut.mutate(row.id, {
      onSuccess: () => toast.success("Pagamento desfeito."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível desfazer o pagamento.")),
    });
  };

  const cancelEntry = async (row: FinanceEntryView) => {
    const ok = await confirm({
      title: "Cancelar lançamento?",
      description: `“${row.description}” (${formatCents(row.amountCents)}) sai dos totais, mas continua no histórico.`,
      confirmLabel: "Cancelar lançamento",
      variant: "destructive",
    });
    if (!ok) return;
    cancelMut.mutate(row.id, {
      onSuccess: () => toast.success("Lançamento cancelado."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível cancelar o lançamento.")),
    });
  };

  const deleteEntry = async (row: FinanceEntryView) => {
    const ok = await confirm({
      title: "Excluir lançamento?",
      description: `“${row.description}” (${formatCents(row.amountCents)}) será apagado de vez. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMut.mutate(row.id, {
      onSuccess: () => toast.success("Lançamento excluído."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível excluir o lançamento.")),
    });
  };

  const endRecurrence = async (row: FinanceEntryView) => {
    if (!row.recurrenceId) return;
    const ok = await confirm({
      title: "Encerrar repetição?",
      description: `“${row.description}” para de se repetir. Os lançamentos pendentes que vencem de hoje em diante são cancelados; os já pagos e os vencidos continuam.`,
      confirmLabel: "Encerrar repetição",
      variant: "destructive",
    });
    if (!ok) return;
    endMut.mutate(row.recurrenceId, {
      onSuccess: (r) =>
        toast.success(
          r.canceled > 0
            ? `Repetição encerrada. ${plural(r.canceled, "lançamento cancelado", "lançamentos cancelados")}.`
            : "Repetição encerrada.",
        ),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível encerrar a repetição.")),
    });
  };

  const actionsFor = (row: FinanceEntryView): ListItemAction[] => {
    if (!canManage || row.source !== "entry") return [];
    const open = row.status === "pending" || row.status === "overdue";
    const actions: ListItemAction[] = [];
    if (open) {
      actions.push({
        key: "pay",
        label: "Marcar pago",
        icon: <CheckCircle2 className="size-4" />,
        onSelect: () => setPaying(row),
      });
    }
    if (row.status === "paid") {
      actions.push({
        key: "undo",
        label: "Desfazer pagamento",
        icon: <RotateCcw className="size-4" />,
        onSelect: () => void undoPayment(row),
      });
    }
    if (row.status !== "canceled") {
      actions.push({
        key: "edit",
        label: "Editar",
        icon: <Pencil className="size-4" />,
        onSelect: () => {
          setEditing(row);
          setFormOpen(true);
        },
      });
    }
    if (row.recurrenceId && row.recurrenceActive && row.status !== "canceled") {
      actions.push({
        key: "end-recurrence",
        label: "Encerrar repetição",
        icon: <Repeat className="size-4" />,
        onSelect: () => void endRecurrence(row),
      });
    }
    if (open) {
      actions.push({
        key: "cancel",
        label: "Cancelar",
        icon: <Ban className="size-4" />,
        onSelect: () => void cancelEntry(row),
        destructive: true,
      });
    }
    // D2: excluir so o que nunca foi pago (o service confere o historico).
    if (row.status !== "paid" && !row.recurrenceId && !row.everPaid) {
      actions.push({
        key: "delete",
        label: "Excluir",
        icon: <Trash2 className="size-4" />,
        onSelect: () => void deleteEntry(row),
        destructive: true,
      });
    }
    return actions;
  };

  // --- Linha ----------------------------------------------------------------

  const renderRow = (row: FinanceEntryView) => {
    const isIncome = row.type === "income";
    const canceled = row.status === "canceled";
    const actions = actionsFor(row);

    let meta: ReactNode;
    let trailing: ReactNode = null;
    if (row.source === "charge" && row.chargeCounts) {
      meta = <span>{chargeCountsLabel(row.chargeCounts)}</span>;
      trailing = (
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link href={billingHref(competence, { kind: chargeKindOf(row) })}>
            Ver em Mensalidades
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      );
    } else if (row.source === "teacher_payout") {
      meta = (
        <>
          <span>{row.categoryName}</span>
          <span>·</span>
          <span>{row.status === "paid" && row.paidAt ? "pago" : `vence ${shortDate(row.dueDate)}`}</span>
        </>
      );
      trailing = (
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link href={financeHref("professores", competence)}>
            <Users className="size-3.5" />
            Ver professores
          </Link>
        </Button>
      );
    } else {
      meta = (
        <>
          <span>{row.categoryName}</span>
          <span>·</span>
          <span title={fullDate(row.dueDate)}>vence {shortDate(row.dueDate)}</span>
          {row.status === "paid" && row.method ? (
            <>
              <span>·</span>
              <span>pago via {paymentMethodLabel(row.method)}</span>
            </>
          ) : null}
          {row.recurrenceId ? (
            <span className="inline-flex items-center gap-0.5" title="Repete todo mês">
              <Repeat className="size-3" aria-hidden />
              <span>mensal</span>
            </span>
          ) : null}
        </>
      );
    }

    const content = (
      <ListRow
        key={row.id}
        aria-label={row.description}
        actions={
          <>
            {trailing}
            {actions.length > 0 ? (
              <ListItemActionsMenu
                actions={actions}
                title="Ações do lançamento"
                ariaLabel={`Ações de ${row.description}`}
                variant="ghost"
              />
            ) : null}
          </>
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              isIncome ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {row.source === "charge" ? (
              <Wallet className="size-4" />
            ) : isIncome ? (
              <ArrowDownLeft className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className={cn("truncate text-sm font-medium text-foreground", canceled && "text-muted-foreground line-through")}>
                {row.description}
              </p>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">{meta}</p>
          </div>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              canceled ? "text-muted-foreground line-through" : isIncome ? "text-success" : "text-foreground",
            )}
          >
            {isIncome ? "+" : "−"} {formatCents(row.amountCents)}
          </span>
        </div>
      </ListRow>
    );

    return actions.length > 0 ? (
      <ListItemContextMenu key={row.id} actions={actions}>
        {content}
      </ListItemContextMenu>
    ) : (
      content
    );
  };

  // --- Estados --------------------------------------------------------------

  let emptyState: ReactNode = null;
  if (isError && !data) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar os lançamentos.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (!isPending && rows.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={() => setSearch("")}
        onClearFilters={clearFilters}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<ArrowLeftRight className="size-7" />}
            title={`Nenhum lançamento em ${competenceLabel(competence).toLowerCase()}`}
            description="Lance as receitas e despesas do mês. As mensalidades aparecem aqui sozinhas quando geradas."
            actionLabel={canManage ? "Novo lançamento" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar lançamento..."
          aria-label="Buscar lançamento"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as TypeFilter);
              setCategoryFilter("all");
            }}
          >
            <SelectTrigger className="sm:w-40" aria-label="Filtrar por tipo">
              <SelectValue>{TYPE_FILTER_LABEL[typeFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_FILTER_LABEL) as TypeFilter[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_FILTER_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-40" aria-label="Filtrar por status">
              <SelectValue>{statusFilterLabel(statusFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusFilterLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="col-span-2 sm:w-48" aria-label="Filtrar por categoria">
              <SelectValue>{selectedCategoryName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {incomeCategories.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Entradas</SelectLabel>
                  {incomeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {expenseCategories.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Saídas</SelectLabel>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        {canManage ? (
          <div className="flex gap-2 lg:ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Tags className="size-4" />
                  Categorias
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setCategoryType("income");
                    setCategoriesOpen(true);
                  }}
                >
                  <ArrowDownLeft className="size-4" />
                  Categorias de entrada
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setCategoryType("expense");
                    setCategoriesOpen(true);
                  }}
                >
                  <ArrowUpRight className="size-4" />
                  Categorias de saída
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!onCreateEntry ? (
              <Button onClick={openCreate} className="flex-1 sm:flex-none">
                <Plus className="size-4" />
                Novo lançamento
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <ListSummaryBar
          count={rows.length}
          singularLabel="lançamento"
          pluralLabel="lançamentos"
          isLoading={isPending}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          className={cn("flex items-center gap-3", isFetching && !isPending && "opacity-70")}
        />
        {!isPending && rows.length > 0 ? (
          <span className="tabular-nums">
            Entradas <span className="font-medium text-success">{formatCents(incomeTotal)}</span>
            {" · "}
            Saídas <span className="font-medium text-foreground">{formatCents(expenseTotal)}</span>
          </span>
        ) : null}
      </div>

      <ListContainer emptyState={emptyState}>
        {isPending ? <EntriesSkeleton /> : rows.map(renderRow)}
      </ListContainer>

      <FinanceEntryFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        entry={editing?.entry}
        competence={competence}
      />
      <FinancePaymentDialog
        key={paying?.id ?? "none"}
        row={paying}
        isPending={paidMut.isPending}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        onConfirm={(method) => paying && pay(paying, method)}
      />
      <FinancialCategoryManagerDialog
        type={categoryType}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
    </div>
  );
}
