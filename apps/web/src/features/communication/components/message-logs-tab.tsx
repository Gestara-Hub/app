"use client";

import { useMemo, useState } from "react";
import type { MessageLog, MessageLogStatus } from "@gestarahub/contracts";
import { formatDateTime, formatPhone } from "@gestarahub/core/format";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMessageLogs, useRetryMessage } from "../hooks/use-communication";

export function MessageLogsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const { data: logs = [], isLoading } = useMessageLogs();
  const retryMutation = useRetryMessage();

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (triggerFilter !== "all") {
        if (triggerFilter === "billing" && log.category !== "billing") return false;
        if (triggerFilter === "retention" && log.category !== "retention") return false;
        if (triggerFilter === "manual" && log.trigger !== "manual_broadcast") return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = log.recipientName.toLowerCase().includes(q);
        const matchesPhone = log.recipientPhone.includes(q);
        const matchesContent = log.content.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesContent) return false;
      }
      return true;
    });
  }, [logs, search, statusFilter, triggerFilter]);

  const handleRetry = async (log: MessageLog) => {
    try {
      await retryMutation.mutateAsync(log.id);
      toast.success(`Disparo reenviado com sucesso para ${log.recipientName}.`);
    } catch {
      toast.error("Não foi possível reenviar o disparo.");
    }
  };

  const renderStatusBadge = (status: MessageLogStatus) => {
    switch (status) {
      case "read":
        return (
          <Badge variant="outline" className="border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 gap-1 text-[11px]">
            <CheckCheck className="size-3 text-sky-600" />
            Lida
          </Badge>
        );
      case "delivered":
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 gap-1 text-[11px]">
            <CheckCheck className="size-3 text-emerald-600" />
            Entregue
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="border-zinc-300 bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 gap-1 text-[11px]">
            <Check className="size-3 text-zinc-500" />
            Enviada
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 gap-1 text-[11px]">
            <AlertTriangle className="size-3 text-rose-600" />
            Falha
          </Badge>
        );
      case "queued":
      default:
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 gap-1 text-[11px]">
            <Clock className="size-3 text-amber-600" />
            Na fila
          </Badge>
        );
    }
  };

  const renderTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case "billing_before_due":
        return "Lembrete 3d antes";
      case "billing_due_date":
        return "Vencimento Hoje";
      case "billing_after_due":
        return "Cobrança 3d após";
      case "billing_critical":
        return "Atraso Crítico 10d";
      case "welcome_student":
        return "Boas-Vindas";
      case "absence_alert":
        return "Anti-Evasão";
      case "birthday_greeting":
        return "Aniversário";
      case "manual_broadcast":
        return "Disparo Manual";
      default:
        return trigger;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno, telefone ou texto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="read">Lida</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
            </SelectContent>
          </Select>

          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="billing">Cobrança</SelectItem>
              <SelectItem value="retention">Retenção</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Registros */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Carregando histórico de envios...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum disparo encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">{renderStatusBadge(log.status)}</div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">
                          {log.recipientName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPhone(log.recipientPhone)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {renderTriggerLabel(log.trigger)}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {log.content}
                      </p>

                      {log.errorReason ? (
                        <p className="text-[11px] text-rose-600 font-medium">
                          Motivo: {log.errorReason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.sentAt)}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setSelectedLog(log)}
                      title="Ver mensagem completa"
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Ver</span>
                    </Button>

                    {log.status === "failed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs text-rose-600 hover:text-rose-700"
                        onClick={() => handleRetry(log)}
                        disabled={retryMutation.isPending}
                      >
                        <RefreshCw className="size-3" />
                        Reenviar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhe da Mensagem */}
      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base">Detalhes do Disparo</DialogTitle>
              {selectedLog ? renderStatusBadge(selectedLog.status) : null}
            </div>
            <DialogDescription className="text-xs">
              Para {selectedLog?.recipientName} ({selectedLog ? formatPhone(selectedLog.recipientPhone) : ""})
            </DialogDescription>
          </DialogHeader>

          {selectedLog ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                <div className="rounded-xl rounded-tl-none border border-emerald-100 bg-white p-3 shadow-2xs dark:border-emerald-900 dark:bg-zinc-900 text-xs">
                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                    {selectedLog.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 border-t pt-1.5 border-zinc-100 dark:border-zinc-800">
                    <span>{renderTriggerLabel(selectedLog.trigger)}</span>
                    <span>{formatDateTime(selectedLog.sentAt)}</span>
                  </div>
                </div>
              </div>

              {selectedLog.errorReason ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                  <p className="font-semibold">Erro no Envio:</p>
                  <p className="mt-0.5">{selectedLog.errorReason}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
