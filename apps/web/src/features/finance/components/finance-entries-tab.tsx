"use client";

import { useTeamWords } from "@/features/settings";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/lib/use-app-router";
import { toast } from "@/lib/toast";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import type {
  ChargeKind,
  FinanceEntryView,
  FinancialEntryDisplayStatus,
  FinancialEntryFilter,
  FinancialEntryType,
} from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  PaginationBar,
  SearchInput,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import type { PaymentDialogResult } from "@/components/shared/payment-dialog";
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
import { useRetainedValue } from "@/lib/use-retained-value";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { useUserPreferences } from "@/features/preferences";
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
  all: "Todos",
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
        "status-dot inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ENTRY_STATUS_CLASS[status],
      )}
    >
      {financialEntryStatusLabel(status)}
    </span>
  );
}

/**
 * "42 pagas · 5 pendentes · 2 atrasadas" do agregado de cobrancas. As atrasadas
 * no tom de vencido, no lugar do selo "Atrasado" da linha (11/11/2026).
 */
function chargeCountsLabel(counts: NonNullable<FinanceEntryView["chargeCounts"]>) {
  const parts: { text: string; overdue?: boolean }[] = [];
  if (counts.paid > 0) parts.push({ text: plural(counts.paid, "paga", "pagas") });
  if (counts.pending > 0) parts.push({ text: plural(counts.pending, "pendente", "pendentes") });
  if (counts.overdue > 0) parts.push({ text: plural(counts.overdue, "atrasada", "atrasadas"), overdue: true });
  return parts.map((part, i) => (
    <span key={part.text}>
      {i > 0 ? " · " : null}
      <span className={cn(part.overdue && "text-overdue")}>{part.text}</span>
    </span>
  ));
}

/** Kind da linha agregada ("charges:<kind>:<competence>"). */
function chargeKindOf(row: FinanceEntryView): ChargeKind {
  const kind = row.id.split(":")[1];
  return kind === "dropin" || kind === "extra" || kind === "course" || kind === "package" ? kind : "membership";
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
  const team = useTeamWords();
  const can = useCan();
  const canManage = can("finance:manage");

  // Filtro inicial vindo de um link (ex.: "Ver contas atrasadas" do Resumo ou clique em categoria).
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const value = searchParams.get("type");
    return value === "income" || value === "expense" ? value : "all";
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get("status") as StatusFilter | null;
    return value && STATUS_FILTERS.includes(value) ? value : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<string>(
    () => searchParams.get("categoryId") ?? "all",
  );
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");

  // Tipo filtrado aqui (nao no servico): as abas Todos/Entradas/Saidas mostram a
  // contagem de cada uma (11/11/2026).
  const filter: FinancialEntryFilter = {
    competence,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(categoryFilter !== "all" ? { categoryId: categoryFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data, isPending, isError, refetch, isFetching } = useFinanceEntries(filter);
  const { data: categories } = useFinancialCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntryView | null>(null);
  const [paying, setPaying] = useState<FinanceEntryView | null>(null);
  // Chave pelo ultimo lancamento: remonta ao abrir outro, nao ao fechar (deixa a saida animar).
  const lastPayingId = useRetainedValue(paying)?.id;
  const [categoryType, setCategoryType] = useState<FinancialEntryType>("expense");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmAction();

  const paidMut = useMarkFinanceEntryPaid();
  const pendingMut = useMarkFinanceEntryPending();
  const cancelMut = useCancelFinanceEntry();
  const deleteMut = useDeleteFinanceEntry();
  const endMut = useEndFinanceRecurrence();

  const router = useAppRouter();
  const allRows = data ?? [];
  const typeCounts = {
    all: allRows.length,
    income: allRows.filter((r) => r.type === "income").length,
    expense: allRows.filter((r) => r.type === "expense").length,
  };
  const rows = typeFilter === "all" ? allRows : allRows.filter((r) => r.type === typeFilter);
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () => preferences.pageSizes?.finance ?? preferences.defaultPageSize ?? 25,
  );

  const filterKey = `${competence}:${typeFilter}:${statusFilter}:${categoryFilter}:${search}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

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
  // Recebido e a receber, com as palavras do Resumo (11/11/2026): o total de
  // entradas misturava pago e aberto e parecia o "Entrou".
  const incomeReceived = active
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + (r.source === "charge" ? (r.chargePaidCents ?? 0) : r.status === "paid" ? r.amountCents : 0), 0);
  const incomeToReceive = incomeTotal - incomeReceived;
  const expenseTotal = active.filter((r) => r.type === "expense").reduce((s, r) => s + r.amountCents, 0);
  const expensePaid = active.filter((r) => r.type === "expense" && r.status === "paid").reduce((s, r) => s + r.amountCents, 0);
  const expenseToPay = expenseTotal - expensePaid;
  // Faixa de totais: so o que vale para a aba (com "Entradas", sem as saidas).
  const totals: { label: string; cents: number; tone?: "success" }[] = [
    ...(typeFilter !== "expense"
      ? [
          { label: "Recebido", cents: incomeReceived, tone: "success" as const },
          { label: "A receber", cents: incomeToReceive },
        ]
      : []),
    ...(typeFilter !== "income"
      ? [
          { label: "Pago", cents: expensePaid },
          { label: "A pagar", cents: expenseToPay },
        ]
      : []),
  ];

  const openCreate = () => {
    if (onCreateEntry) {
      onCreateEntry();
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  // --- Acoes (todas com dinheiro confirmam) -------------------------------

  const pay = (row: FinanceEntryView, { method, paidOn, receipts }: PaymentDialogResult) =>
    paidMut.mutate(
      { id: row.id, method, paidOn, receipts },
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
    // Linha que abre outra tela (11/11/2026): a linha inteira e o link, com so a
    // seta a direita (o texto "Ver em Cobranças" se repetia em toda linha).
    let rowHref: string | null = null;
    let rowHrefLabel = "";
    if (row.source === "charge" && row.chargeCounts) {
      meta = <span>{chargeCountsLabel(row.chargeCounts)}</span>;
      rowHref = billingHref(competence, { kind: chargeKindOf(row) });
      rowHrefLabel = "Ver em Cobranças";
    } else if (row.source === "online_fee") {
      // Taxas do pagamento online: so leitura, com atalho para o extrato dos recebimentos.
      meta = (
        <>
          <span>{plural(row.onlinePaymentCount ?? 0, "pagamento online", "pagamentos online")}</span>
          <span>·</span>
          <span>parceiro e GestaraHub</span>
        </>
      );
      rowHref = "/online-payments";
      rowHrefLabel = "Ver recebimentos online";
    } else if (row.source === "teacher_payout") {
      meta = (
        <>
          <span>{row.categoryName}</span>
          <span>·</span>
          <span>{row.status === "paid" && row.paidAt ? "pago" : `vence ${shortDate(row.dueDate)}`}</span>
        </>
      );
      rowHref = financeHref("professores", competence);
      rowHrefLabel = `Ver ${team.lowerPlural}`;
    } else {
      meta = (
        <>
          <span>{row.categoryName}</span>
          {row.eventName ? (
            <>
              <span>·</span>
              <span className="min-w-0 break-words">evento {row.eventName}</span>
            </>
          ) : null}
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
          {row.entry?.attachments?.length ? (
            <span
              className="inline-flex items-center gap-0.5"
              title={plural(row.entry.attachments.length, "comprovante", "comprovantes")}
            >
              <Paperclip className="size-3" aria-hidden />
              <span>{row.entry.attachments.length}</span>
            </span>
          ) : null}
        </>
      );
    }

    const content = (
      <ListRow
        key={row.id}
        data-record-id={row.id}
        aria-label={row.description}
        {...(rowHref ? { onClick: () => router.push(rowHref), mouseOnly: true } : {})}
        actions={
          <>
            {rowHref ? (
              <Button asChild variant="ghost" size="icon-sm" title={rowHrefLabel}>
                <Link href={rowHref} aria-label={rowHrefLabel}>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : null}
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
              <p className={cn("break-words text-sm font-medium text-foreground", canceled && "text-muted-foreground line-through")}>
                {row.description}
              </p>
              {/* Agregado de cobrancas: sem selo; a linha de baixo ja conta pagas, pendentes e atrasadas. */}
              {row.source === "charge" ? null : <StatusBadge status={row.status} />}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">{meta}</p>
          </div>
          {/* Valor neutro (11/11/2026): verde so no que entrou de fato (lancamento
              pago); o agregado de cobrancas mostra embaixo quanto ja foi recebido. */}
          <div className="shrink-0 text-right">
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                canceled
                  ? "text-muted-foreground line-through"
                  : isIncome && row.source !== "charge" && row.status === "paid"
                    ? "text-success"
                    : "text-foreground",
              )}
            >
              {isIncome ? "+" : "−"} {formatCents(row.amountCents)}
            </span>
            {row.source === "charge" && (row.chargePaidCents ?? 0) > 0 ? (
              <p className="text-[11px] tabular-nums text-success">{formatCents(row.chargePaidCents ?? 0)} recebido</p>
            ) : null}
          </div>
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
        <Button variant="outline" onClick={() => refetch()}>
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-auto sm:min-w-40" aria-label="Filtrar por status">
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
            <SelectTrigger className="col-span-2 sm:w-auto sm:min-w-48" aria-label="Filtrar por categoria">
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

      {/* Tipo em abas com contagem, como em Cobranças (11/11/2026). */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
        {(Object.keys(TYPE_FILTER_LABEL) as TypeFilter[]).map((t) => {
          const isActive = typeFilter === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setTypeFilter(t);
                setCategoryFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{TYPE_FILTER_LABEL[t]}</span>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {isPending ? "–" : typeCounts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Totais da lista (mudam com os filtros): faixa propria, numero em tamanho de texto. */}
      {!isPending && rows.length > 0 ? (
        <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-2xs">
          {totals.map((t) => (
            <div key={t.label} className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={cn("text-base font-semibold tabular-nums", t.tone === "success" ? "text-success" : "text-foreground")}>
                {formatCents(t.cents)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

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
      </div>

      <ListContainer emptyState={emptyState}>
        {isPending ? <EntriesSkeleton /> : paginatedRows.map(renderRow)}
      </ListContainer>

      {/* Paginacao so com mais de uma pagina: com uma, repetia a contagem de cima. */}
      {!isPending && rows.length > pageSize && (
        <PaginationBar
          screenKey="finance"
          page={page}
          pageSize={pageSize}
          total={rows.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemLabel="lançamentos"
        />
      )}

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
        key={lastPayingId ?? "none"}
        row={paying}
        isPending={paidMut.isPending}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        onConfirm={(payment) => paying && pay(paying, payment)}
      />
      <FinancialCategoryManagerDialog
        type={categoryType}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
    </div>
  );
}
