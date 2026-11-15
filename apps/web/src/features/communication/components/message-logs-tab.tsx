"use client";

import { useRetainedValue } from "@/lib/use-retained-value";
import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Eye,
  MessageCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { MessageLog, MessageLogKind, MessageLogStatus } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime, formatPhone } from "@gestarahub/core/format";
import { relativeDateLabel, dateInSpace } from "@gestarahub/core/date";
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
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMessageLogsPage, useRetryMessage, useWhatsAppConnection } from "../hooks/use-communication";
import { useUserPreferences } from "@/features/preferences";
import { STATUS_META, TRIGGER_META } from "../message-meta";
import { MessageBubble } from "./message-bubble";

type KindFilter = MessageLogKind;
type PeriodFilter = "all" | "today" | "7d" | "month";

const STATUS_FILTERS: { value: "all" | MessageLogStatus; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "opened", label: "Aberto no WhatsApp" },
  { value: "queued", label: "Na fila" },
  { value: "sent", label: "Enviada" },
  { value: "delivered", label: "Entregue" },
  { value: "read", label: "Lida" },
  { value: "failed", label: "Falhou" },
];

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "billing", label: "Cobrança" },
  { value: "retention", label: "Relacionamento" },
  { value: "notices", label: "Avisos" },
  { value: "manual", label: "Avulsa" },
];

const PERIOD_FILTERS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "month", label: "Este mês" },
];

function periodRange(period: PeriodFilter): { dateFrom?: string; dateTo?: string } {
  if (period === "all") return {};
  const today = dateInSpace();
  if (period === "today") return { dateFrom: today, dateTo: today };
  if (period === "month") return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  const anchor = new Date(`${today}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - 6);
  return { dateFrom: anchor.toISOString().slice(0, 10), dateTo: today };
}

/** Os tiques do WhatsApp: enviada ✓, entregue e lida ✓✓ (a cor diferencia a lida). */
const STATUS_ICON: Record<MessageLogStatus, LucideIcon> = {
  opened: ExternalLink,
  queued: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

export function MessageStatusBadge({ status }: { status: MessageLogStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_META[status].className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_META[status].label}
    </span>
  );
}

export function phoneLabel(phone: string): string {
  return formatPhone(phone.replace(/^55(?=\d{10,11}$)/, ""));
}

export function MessageLogsTab({
  initialStatus = "all",
  initialKind = "all",
  initialPeriod = "all",
}: {
  initialStatus?: "all" | MessageLogStatus;
  initialKind?: KindFilter;
  initialPeriod?: PeriodFilter;
} = {}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | MessageLogStatus>(initialStatus);
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [period, setPeriod] = useState<PeriodFilter>(initialPeriod);
  const [selected, setSelected] = useState<MessageLog | null>(null);
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () => preferences.pageSizes?.communication ?? preferences.defaultPageSize ?? 25,
  );
  // Filtros e paginacao no banco (doc 19, secao 12): a tela traz so a pagina.
  const { data, isPending } = useMessageLogsPage({
    search: search.trim() || undefined,
    status,
    kind,
    ...periodRange(period),
    page,
    pageSize,
  });
  const { data: connection } = useWhatsAppConnection();
  const retryMut = useRetryMessage();
  const official = connection?.mode === "official";

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const hasSearch = search.trim().length > 0;
  const hasFilters = status !== "all" || kind !== "all" || period !== "all";
  const clearFilters = () => {
    setStatus("all");
    setKind("all");
    setPeriod("all");
    setPage(1);
  };

  function retry(log: MessageLog) {
    retryMut.mutate(log.id, {
      onSuccess: () => toast.success(`Mensagem reenviada para ${log.recipientName}.`),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível reenviar a mensagem.")),
    });
  }

  function actionsFor(log: MessageLog): ListItemAction[] {
    return [
      { key: "view", label: "Ver mensagem", icon: <Eye className="size-4" />, onSelect: () => setSelected(log) },
      ...(official && log.status === "failed"
        ? [{ key: "retry", label: "Reenviar", icon: <RefreshCw className="size-4" />, onSelect: () => retry(log) }]
        : []),
    ];
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Buscar por aluno, telefone ou texto..."
          className="lg:max-w-sm"
        />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as "all" | MessageLogStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as KindFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-auto sm:min-w-40" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as PeriodFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-auto sm:min-w-40" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ListSummaryBar
        count={total}
        singularLabel="mensagem"
        pluralLabel="mensagens"
        isLoading={isPending}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      />

      <ListContainer
        emptyState={
          !isPending && rows.length === 0 ? (
            <ListEmptyState
              hasSearch={hasSearch}
              hasFilters={hasFilters}
              onClearSearch={() => {
                setSearch("");
                setPage(1);
              }}
              onClearFilters={clearFilters}
              emptyGuide={
                <ModuleEmptyGuide
                  icon={<MessageCircle className="size-8" />}
                  title="Nenhuma mensagem ainda"
                  description="As mensagens abertas no WhatsApp ou enviadas pelo sistema aparecem aqui."
                />
              }
            />
          ) : undefined
        }
      >
        {rows.map((log) => {
          const actions = actionsFor(log);
          return (
            <ListItemContextMenu key={log.id} actions={actions}>
              <ListRow
                aria-label={`Mensagem para ${log.recipientName}`}
                onClick={() => setSelected(log)}
                actions={
                  <ListItemActionsMenu
                    actions={actions}
                    title="Ações da mensagem"
                    ariaLabel={`Ações da mensagem para ${log.recipientName}`}
                    variant="ghost"
                  />
                }
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{log.recipientName}</span>
                    <MessageStatusBadge status={log.status} />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{TRIGGER_META[log.trigger]?.label ?? "Mensagem"}</span>
                    <span>·</span>
                    <span>{phoneLabel(log.recipientPhone)}</span>
                    <span>·</span>
                    <span title={formatDateTime(log.sentAt)}>{relativeDateLabel(dateInSpace(log.sentAt))}</span>
                  </p>
                  {log.status === "failed" && log.errorReason ? (
                    <p className="truncate text-xs text-destructive">{log.errorReason}</p>
                  ) : null}
                </div>
              </ListRow>
            </ListItemContextMenu>
          );
        })}
      </ListContainer>

      {!isPending && rows.length > 0 && (
        <PaginationBar
          screenKey="communication"
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemLabel="mensagens"
        />
      )}

      <MessageDetailSheet message={selected} onOpenChange={(open) => (!open ? setSelected(null) : undefined)} />
    </div>
  );
}

/** Mensagem completa (texto, situacao e data), na gaveta lateral como os outros detalhes. */
export function MessageDetailSheet({
  message,
  onOpenChange,
}: {
  message: MessageLog | null;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = useRetainedValue(message);
  const { data: connection } = useWhatsAppConnection();
  const retryMut = useRetryMessage();
  const canRetry = connection?.mode === "official" && selected?.status === "failed";

  return (
    <Sheet open={Boolean(message)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {selected ? TRIGGER_META[selected.trigger]?.label ?? "Mensagem" : "Mensagem"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {selected ? `${selected.recipientName} · ${phoneLabel(selected.recipientPhone)}` : ""}
          </SheetDescription>
        </SheetHeader>
        {selected ? (
          <>
            <DialogBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <MessageStatusBadge status={selected.status} />
                <span>{formatDateTime(selected.sentAt)}</span>
              </div>
              <MessageBubble text={selected.content} />
              {selected.status === "opened" ? (
                <p className="text-xs text-muted-foreground">
                  O WhatsApp foi aberto com esta mensagem. O envio é feito por quem estava no aparelho.
                </p>
              ) : null}
              {selected.errorReason ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {selected.errorReason}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter className="shrink-0 border-t border-border/40 bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              {canRetry ? (
                <Button
                  type="button"
                  disabled={retryMut.isPending}
                  onClick={() => {
                    retryMut.mutate(selected.id, {
                      onSuccess: () => {
                        toast.success(`Mensagem reenviada para ${selected.recipientName}.`);
                        onOpenChange(false);
                      },
                      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível reenviar a mensagem.")),
                    });
                  }}
                >
                  <RefreshCw className={cn("size-4", retryMut.isPending && "animate-spin")} />
                  {retryMut.isPending ? "Reenviando..." : "Reenviar"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
