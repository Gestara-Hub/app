"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Mail,
  Pencil,
  Phone,
  Power,
  PowerOff,
  RotateCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import { formatPhone } from "@gestarahub/core/format";
import { recordStatusLabel } from "@/lib/labels";
import type { Client, ClientFilter, RecordStatus } from "@gestarahub/contracts";
import { useClients } from "../hooks/use-clients";

interface ClientsListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  onInactivate: (client: Client) => void;
  onReactivate: (client: Client) => void;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ClientRow({
  client,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  canManage: boolean;
  onEdit: (c: Client) => void;
  onInactivate: (c: Client) => void;
  onReactivate: (c: Client) => void;
}) {
  const isActive = client.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(client),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(client),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(client),
            },
      ]
    : [];

  const content = (
    <div
      onClick={() => {
        if (canManage) onEdit(client);
      }}
      className={cn(
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150",
        "hover:bg-muted/40",
        canManage && "cursor-pointer",
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Avatar className="size-9 shrink-0 border border-border/50 bg-muted/60 text-xs font-semibold text-foreground/80 select-none">
          <AvatarFallback className="bg-muted/70 text-foreground text-xs font-semibold">
            {getInitials(client.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {client.name}
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(client.status)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            {client.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground/60" />
                <span>{formatPhone(client.phone)}</span>
              </span>
            ) : null}
            {client.email ? (
              <span className="inline-flex items-center gap-1.5 truncate">
                <Mail className="size-3 text-muted-foreground/60" />
                <span className="truncate">{client.email}</span>
              </span>
            ) : null}
            {client.notes ? (
              <span className="inline-flex items-center gap-1.5 truncate text-muted-foreground/70 max-w-sm">
                <span className="text-muted-foreground/30">·</span>
                <span className="truncate italic">{client.notes}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do cliente"
            variant="ghost"
          />
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="space-y-1.5 min-w-0 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function ClientsList({
  canManage,
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ClientsListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const filter: ClientFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useClients(filter);
  const clients = data ?? [];

  const hasSearch = Boolean(filter.search);
  const hasFilters = Boolean(filter.status);

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" showAction={canManage} />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os clientes. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (clients.length === 0) {
    emptyState = hasSearch ? (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum resultado para esta busca.
        </p>
        <Button variant="outline" size="sm" onClick={clearSearch}>
          Limpar busca
        </Button>
      </div>
    ) : hasFilters ? (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum resultado para os filtros aplicados.
        </p>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Limpar filtros
        </Button>
      </div>
    ) : (
      <div className="py-6">
        <ModuleEmptyGuide
          icon={<Users className="size-8" />}
          title="Nenhum cliente cadastrado ainda."
          description="Cadastre seus clientes para agendá-los e acompanhar o histórico."
          actionLabel={canManage ? "Cadastrar cliente" : undefined}
          onAction={canManage ? onCreate : undefined}
        />
      </div>
    );
  } else {
    items = clients.map((client) => (
      <ClientRow
        key={client.id}
        client={client}
        canManage={canManage}
        onEdit={onEdit}
        onInactivate={onInactivate}
        onReactivate={onReactivate}
      />
    ));
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-9 pr-8"
            autoComplete="off"
            aria-label="Buscar cliente"
          />
          {search ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as "all" | RecordStatus)}
        >
          <SelectTrigger className="sm:w-36" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contador / Resumo */}
      {!isPending && !isError && clients.length > 0 ? (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {clients.length === 1
              ? "1 cliente cadastrado"
              : `${clients.length} clientes cadastrados`}
          </span>
          {hasSearch || hasFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-primary hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Container Unificado da Lista */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs">
        {emptyState ? (
          emptyState
        ) : (
          <div className="divide-y divide-border/40">{items}</div>
        )}
      </div>
    </div>
  );
}
