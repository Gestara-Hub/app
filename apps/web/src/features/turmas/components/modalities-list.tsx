"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Shapes,
} from "lucide-react";
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
  SkeletonCards,
  StatusFilterSelect,
  ViewModeToggle,
  useViewMode,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import type { Category, CategoryFilter, RecordStatus } from "@gestarahub/contracts";
import { useCategories } from "@/features/categories";

interface ModalitiesListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (modality: Category) => void;
  onInactivate: (modality: Category) => void;
  onReactivate: (modality: Category) => void;
}

function ModalityRow({
  modality,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  modality: Category;
  canManage: boolean;
  onEdit: (m: Category) => void;
  onInactivate: (m: Category) => void;
  onReactivate: (m: Category) => void;
}) {
  const isActive = modality.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(modality),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(modality),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(modality),
            },
      ]
    : [];

  const content = (
    <ListRow
      onClick={() => onEdit(modality)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title={`Ações de ${modality.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {modality.name}
        </p>
        <RecordStatusBadge status={modality.status} />
      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function ModalityCard({
  modality,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  modality: Category;
  canManage: boolean;
  onEdit: (m: Category) => void;
  onInactivate: (m: Category) => void;
  onReactivate: (m: Category) => void;
}) {
  const isActive = modality.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(modality),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(modality),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(modality),
            },
      ]
    : [];

  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={() => canManage && onEdit(modality)}
      onKeyDown={(e) => {
        if (!canManage) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(modality);
        }
      }}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-2xs transition-all",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <InitialsAvatar name={modality.name} size="default" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {modality.name}
            </p>
            <RecordStatusBadge status={modality.status} />
          </div>
        </div>
      </div>

      {canManage ? (
        <div
          className="-mr-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ListItemActionsMenu
            actions={actions}
            title={`Ações de ${modality.name}`}
            variant="ghost"
          />
        </div>
      ) : null}
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <Skeleton className="h-4 w-36" />
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function ModalitiesList({
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: ModalitiesListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const [viewMode, setViewMode] = useViewMode("modalities", "list");

  const filter: CategoryFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useCategories(filter);
  const modalities = data ?? [];

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
          Não foi possível carregar as modalidades. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (modalities.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Shapes className="size-8" />}
            title="Nenhuma modalidade cadastrada ainda."
            description="Cadastre as modalidades oferecidas para organizar turmas e professores."
          />
        }
      />
    );
  } else {
    items = modalities.map((modality) => (
      <ModalityRow
        key={modality.id}
        modality={modality}
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
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Buscar modalidade..."
          aria-label="Buscar modalidade"
        />

        <div className="flex items-center gap-2">
          <StatusFilterSelect
            value={status}
            onChange={setStatus}
            gender="female"
          />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Contador / Resumo */}
      {!isError ? (
        <ListSummaryBar
          isLoading={isPending}
          count={modalities.length}
          singularLabel="modalidade cadastrada"
          pluralLabel="modalidades cadastradas"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista ou Grade de Cards */}
      {isPending && viewMode === "grid" ? (
        <SkeletonCards compact showAction={canManage} />
      ) : !isPending && !isError && modalities.length > 0 && viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modalities.map((modality) => (
            <ModalityCard
              key={modality.id}
              modality={modality}
              canManage={canManage}
              onEdit={onEdit}
              onInactivate={onInactivate}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      ) : (
        <ListContainer emptyState={emptyState}>
          {items}
        </ListContainer>
      )}
    </div>
  );
}
