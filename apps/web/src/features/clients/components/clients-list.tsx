"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Pencil,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListCard } from "@/components/shared/list-card";
import { ListItemCard } from "@/components/shared/list-item-card";
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
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
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

  const meta = [formatPhone(client.phone), client.email, client.notes]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <ListItemCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{client.name}</p>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(client.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        </div>
        {canManage ? (
          <ListItemActionsMenu actions={actions} title="Ações do cliente" />
        ) : null}
      </div>
    </ListItemCard>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        {showAction ? <Skeleton className="size-8 rounded-md" /> : null}
      </div>
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
      <ModuleEmptyGuide
        icon={<Users className="size-8" />}
        title="Nenhum cliente cadastrado ainda."
        description="Cadastre seus clientes para agendá-los e acompanhar o histórico."
        actionLabel={canManage ? "Cadastrar cliente" : undefined}
        onAction={canManage ? onCreate : undefined}
      />
    );
  }

  return (
    <ListCard
      items={items}
      emptyState={emptyState}
      filters={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="px-8"
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
      }
    />
  );
}
