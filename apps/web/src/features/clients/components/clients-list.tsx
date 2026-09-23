"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Mail, Pencil, Phone, Power, PowerOff, RotateCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InitialsAvatar,
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  RecordStatusBadge,
  SearchInput,
  StatusFilterSelect,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { formatPhone } from "@gestarahub/core/format";
import type { Client, ClientFilter, RecordStatus } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useClients } from "../hooks/use-clients";

interface ClientsListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  onInactivate: (client: Client) => void;
  onReactivate: (client: Client) => void;
}

function ClientRow({
  client,
  canManage,
  isClasses,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  canManage: boolean;
  isClasses: boolean;
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
    <ListRow
      onClick={() => onEdit(client)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title={isClasses ? "Ações do aluno" : "Ações do cliente"}
            ariaLabel={`Ações de ${client.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <InitialsAvatar name={client.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {client.name}
            </p>
            <RecordStatusBadge status={client.status} />
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
    </ListRow>
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
  const isClasses = useModel() === "classes";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const filter: ClientFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useClients(filter);
  const clients = data ?? [];

  const hasSearch = Boolean(filter.search);
  const hasFilters = status !== "all";

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
          {isClasses
            ? "Não foi possível carregar os alunos. Tente novamente."
            : "Não foi possível carregar os clientes. Tente novamente."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (clients.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Users className="size-8" />}
            title={
              isClasses
                ? "Nenhum aluno cadastrado ainda."
                : "Nenhum cliente cadastrado ainda."
            }
            description={
              isClasses
                ? "Cadastre seus alunos para matriculá-los em turmas e acompanhar mensalidades."
                : "Cadastre seus clientes para agendá-los e acompanhar o histórico."
            }
            actionLabel={
              canManage
                ? isClasses
                  ? "Cadastrar aluno"
                  : "Cadastrar cliente"
                : undefined
            }
            onAction={canManage ? onCreate : undefined}
          />
        }
      />
    );
  } else {
    items = clients.map((client) => (
      <ClientRow
        key={client.id}
        client={client}
        canManage={canManage}
        isClasses={isClasses}
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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou telefone..."
          aria-label={isClasses ? "Buscar aluno" : "Buscar cliente"}
        />
        <StatusFilterSelect value={status} onChange={setStatus} />
      </div>

      {/* Contador / Resumo */}
      {!isPending && !isError && clients.length > 0 ? (
        <ListSummaryBar
          count={clients.length}
          singularLabel={isClasses ? "aluno cadastrado" : "cliente cadastrado"}
          pluralLabel={isClasses ? "alunos cadastrados" : "clientes cadastrados"}
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista */}
      <ListContainer emptyState={emptyState}>{items}</ListContainer>
    </div>
  );
}

