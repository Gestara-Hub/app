"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Eye, MessageCircle, MessageSquarePlus } from "lucide-react";
import type { MessageLog, MessageLogStatus } from "@gestarahub/contracts";
import { formatDateTime } from "@gestarahub/core/format";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeText } from "@/lib/text";
import { useMessageLogs } from "../hooks/use-communication";
import { STATUS_META, TRIGGER_META } from "../message-meta";
import { MessageDetailDialog, MessageStatusBadge } from "./message-logs-tab";
import { SendMessageDialog, type MessageRecipient } from "./send-message-dialog";

const STATUS_FILTERS: { value: "all" | MessageLogStatus; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "opened", label: STATUS_META.opened.label },
  { value: "delivered", label: STATUS_META.delivered.label },
  { value: "read", label: STATUS_META.read.label },
  { value: "failed", label: STATUS_META.failed.label },
];

/** "Hoje às 10:30", "Há 3 dias às 08:00", "12/09/2026 às 19:10". */
function sentLabel(iso: string): string {
  const day = relativeDateLabel(format(parseISO(iso), "yyyy-MM-dd"));
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} às ${format(parseISO(iso), "HH:mm")}`;
}

/**
 * Mensagens de WhatsApp de um aluno (ficha do aluno, aba Mensagens), da mais
 * nova, com "Nova mensagem" para ele.
 */
export function StudentMessagesPanel({
  student,
  canSend,
}: {
  student: MessageRecipient;
  canSend: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | MessageLogStatus>("all");
  const [selected, setSelected] = useState<MessageLog | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const { data: logs = [], isPending } = useMessageLogs({ clientId: student.id });

  const query = normalizeText(search);
  const rows = logs.filter(
    (log) =>
      (status === "all" || log.status === status) &&
      (query === "" ||
        normalizeText(log.content).includes(query) ||
        normalizeText(TRIGGER_META[log.trigger]?.label ?? "").includes(query)),
  );
  const hasFilters = status !== "all";

  const actionsFor = (log: MessageLog): ListItemAction[] => [
    { key: "view", label: "Ver mensagem", icon: <Eye className="size-4" />, onSelect: () => setSelected(log) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar no texto..."
          aria-label="Buscar mensagem"
        />
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | MessageLogStatus)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Status">
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
          {canSend ? (
            <Button className="shrink-0" onClick={() => setSendOpen(true)}>
              <MessageSquarePlus className="size-4" />
              Nova mensagem
            </Button>
          ) : null}
        </div>
      </div>

      <ListSummaryBar
        count={rows.length}
        singularLabel="mensagem"
        pluralLabel="mensagens"
        isLoading={isPending}
        hasFilters={hasFilters || query !== ""}
        onClearFilters={() => {
          setSearch("");
          setStatus("all");
        }}
      />

      <ListContainer
        emptyState={
          !isPending && rows.length === 0 ? (
            <ListEmptyState
              hasSearch={query !== ""}
              hasFilters={hasFilters}
              onClearSearch={() => setSearch("")}
              onClearFilters={() => setStatus("all")}
              emptyGuide={
                <ModuleEmptyGuide
                  icon={<MessageCircle className="size-8" />}
                  title="Nenhuma mensagem ainda."
                  description="Lembretes e mensagens pelo WhatsApp aparecem aqui."
                  actionLabel={canSend ? "Nova mensagem" : undefined}
                  onAction={canSend ? () => setSendOpen(true) : undefined}
                />
              }
            />
          ) : undefined
        }
      >
        {isPending
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 px-4 py-3.5 sm:px-5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            ))
          : rows.map((log) => {
              const actions = actionsFor(log);
              return (
                <ListItemContextMenu key={log.id} actions={actions}>
                  <ListRow
                    aria-label={`Mensagem de ${formatDateTime(log.sentAt)}`}
                    onClick={() => setSelected(log)}
                    actions={
                      <ListItemActionsMenu
                        actions={actions}
                        title="Ações da mensagem"
                        ariaLabel="Ações da mensagem"
                        variant="ghost"
                      />
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {TRIGGER_META[log.trigger]?.label ?? "Mensagem"}
                      </span>
                      <MessageStatusBadge status={log.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sentLabel(log.sentAt)}
                    </p>
                  </ListRow>
                </ListItemContextMenu>
              );
            })}
      </ListContainer>

      <MessageDetailDialog message={selected} onOpenChange={(open) => (!open ? setSelected(null) : undefined)} />
      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} recipient={student} />
    </div>
  );
}
