"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  Clock,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Search,
  Tag,
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
import { formatCents, formatDuration } from "@gestarahub/core/format";
import { recordStatusLabel } from "@/lib/labels";
import type { RecordStatus, Service, ServiceFilter } from "@gestarahub/contracts";
import { useCategories } from "@/features/categories";
import { useServices } from "../hooks/use-services";

interface ServicesListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (service: Service) => void;
  onInactivate: (service: Service) => void;
  onReactivate: (service: Service) => void;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

function ServiceRow({
  service,
  categoryName,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  service: Service;
  categoryName: string;
  canManage: boolean;
  onEdit: (s: Service) => void;
  onInactivate: (s: Service) => void;
  onReactivate: (s: Service) => void;
}) {
  const isActive = service.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(service),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(service),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(service),
            },
      ]
    : [];

  const content = (
    <div
      onClick={() => canManage && onEdit(service)}
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onKeyDown={(e) => {
        if (canManage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit(service);
        }
      }}
      className={cn(
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40",
        canManage && "cursor-pointer",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {service.name}
          </p>
          {categoryName ? (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {categoryName}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
              statusPillClass(isActive),
            )}
          >
            {recordStatusLabel(service.status)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3 text-muted-foreground/60" />
            {formatDuration(service.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Banknote className="size-3 text-muted-foreground/60" />
            {formatCents(service.priceCents)}
          </span>
          {service.description ? (
            <span className="truncate max-w-md text-muted-foreground/75">
              · {service.description}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do serviço"
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
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function ServicesList({
  canManage,
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ServicesListProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<"all" | string>("all");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const filter: ServiceFilter = {
    search: search.trim() || undefined,
    categoryId: categoryId === "all" ? undefined : categoryId,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useServices(filter);
  const { data: categories } = useCategories({ status: "active" });
  const services = data ?? [];

  const categoryNameById = new Map(
    (categories ?? []).map((c) => [c.id, c.name]),
  );

  const hasSearch = Boolean(filter.search);
  const hasFilters = Boolean(filter.categoryId || status !== "all");

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setCategoryId("all");
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
          Não foi possível carregar os serviços. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (services.length === 0) {
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
          icon={<Tag className="size-8" />}
          title="Nenhum serviço cadastrado ainda."
          description="Cadastre os serviços do seu catálogo para usá-los nos agendamentos."
          actionLabel={canManage ? "Cadastrar serviço" : undefined}
          onAction={canManage ? onCreate : undefined}
        />
      </div>
    );
  } else {
    items = services.map((service) => (
      <ServiceRow
        key={service.id}
        service={service}
        categoryName={
          service.categoryId
            ? (categoryNameById.get(service.categoryId) ?? "")
            : ""
        }
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
            placeholder="Buscar por nome ou descrição..."
            className="pl-9 pr-8"
            autoComplete="off"
            aria-label="Buscar serviço"
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
          value={categoryId}
          onValueChange={(value) => setCategoryId(value)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
      {!isPending && !isError && services.length > 0 ? (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {services.length === 1
              ? "1 serviço cadastrado"
              : `${services.length} serviços cadastrados`}
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
