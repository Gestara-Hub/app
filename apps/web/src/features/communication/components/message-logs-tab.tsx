"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Eye, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { MessageLog, MessageLogStatus } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime, formatPhone } from "@gestarahub/core/format";
import { relativeDateLabel } from "@gestarahub/core/date";
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
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMessageLogs, useRetryMessage, useWhatsAppConnection } from "../hooks/use-communication";
import { STATUS_META, TRIGGER_META } from "../message-meta";
import { MessageBubble } from "./message-bubble";

type KindFilter = "all" | "billing" | "retention" | "notices" | "manual";

const STATUS_FILTERS: { value: "all" | MessageLogStatus; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "opened", label: "Aberto no WhatsApp" },
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

export function MessageStatusBadge({ status }: { status: MessageLogStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_META[status].className)}>
      {STATUS_META[status].label}
    </span>
  );
}

export function phoneLabel(phone: string): string {
  return formatPhone(phone.replace(/^55(?=\d{10,11}$)/, ""));
}

export function MessageLogsTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | MessageLogStatus>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [selected, setSelected] = useState<MessageLog | null>(null);
  const { data: logs = [], isPending } = useMessageLogs({ search: search.trim() || undefined, status });
  const { data: connection } = useWhatsAppConnection();
  const retryMut = useRetryMessage();
  const official = connection?.mode === "official";

  const rows = logs.filter((log) => {
    if (kind === "manual") return log.trigger === "manual_broadcast";
    if (kind === "billing") return log.category === "billing";
    if (kind === "retention") return log.category === "retention";
    // Aula cancelada, mudanca de horario e feriado (antes caiam em "Avulsa").
    if (kind === "notices") return log.category === "administrative" && log.trigger !== "manual_broadcast";
    return true;
  });
  const hasSearch = search.trim().length > 0;
  const hasFilters = status !== "all" || kind !== "all";
  const clearFilters = () => {
    setStatus("all");
    setKind("all");
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por aluno, telefone ou texto..."
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | MessageLogStatus)}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-48" aria-label="Status">
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
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label="Tipo">
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
        </div>
      </div>

      <ListSummaryBar
        count={rows.length}
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
              onClearSearch={() => setSearch("")}
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
                    <span title={formatDateTime(log.sentAt)}>{relativeDateLabel(format(parseISO(log.sentAt), "yyyy-MM-dd"))}</span>
                  </p>
                </div>
              </ListRow>
            </ListItemContextMenu>
          );
        })}
      </ListContainer>

      <MessageDetailDialog message={selected} onOpenChange={(open) => (!open ? setSelected(null) : undefined)} />
    </div>
  );
}

/** Mensagem completa (texto, situacao e data). */
export function MessageDetailDialog({
  message: selected,
  onOpenChange,
}: {
  message: MessageLog | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(selected)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>{selected ? TRIGGER_META[selected.trigger]?.label ?? "Mensagem" : "Mensagem"}</DialogTitle>
          <DialogDescription>
            {selected ? `${selected.recipientName} · ${phoneLabel(selected.recipientPhone)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {selected ? (
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
