"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Search,
  Shapes,
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
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import { recordStatusLabel } from "@/lib/labels";
import type { Category, CategoryFilter, RecordStatus } from "@gestarahub/contracts";
import { useCategories } from "@/features/categories";

interface ModalitiesListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (modality: Category) => void;
  onInactivate: (modality: Category) => void;
  onReactivate: (modality: Category) => void;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
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
    <div
      onClick={() => canManage && onEdit(modality)}
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onKeyDown={(e) => {
        if (canManage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit(modality);
        }
      }}
      className={cn(
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40",
        canManage && "cursor-pointer",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {modality.name}
        </p>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
            statusPillClass(isActive),
          )}
        >
          {recordStatusLabel(modality.status)}
        </span>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações da modalidade"
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
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ModalitiesListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

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
          icon={<Shapes className="size-8" />}
          title="Nenhuma modalidade cadastrada ainda."
          description="Cadastre as modalidades oferecidas (ex.: Judô, Yoga) para organizar turmas e instrutores."
          actionLabel={canManage ? "Cadastrar modalidade" : undefined}
          onAction={canManage ? onCreate : undefined}
        />
      </div>
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
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar modalidade..."
            className="pl-9 pr-8"
            autoComplete="off"
            aria-label="Buscar modalidade"
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
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contador / Resumo */}
      {!isPending && !isError && modalities.length > 0 ? (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {modalities.length === 1
              ? "1 modalidade cadastrada"
              : `${modalities.length} modalidades cadastradas`}
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
