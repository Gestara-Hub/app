"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
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
import { ListCard } from "@/components/shared/list-card";
import { ListItemCard } from "@/components/shared/list-item-card";
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
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
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
    <ListItemCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{service.name}</p>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(service.status)}
            </span>
            <span className="text-xs text-muted-foreground">{categoryName}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatDuration(service.durationMinutes)} ·{" "}
            {formatCents(service.priceCents)}
            {service.description ? ` · ${service.description}` : ""}
          </p>
        </div>
        {canManage ? (
          <ListItemActionsMenu actions={actions} title="Ações do serviço" />
        ) : null}
      </div>
    </ListItemCard>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        {showAction ? <Skeleton className="size-8 rounded-md" /> : null}
      </div>
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
  const hasFilters = Boolean(filter.categoryId || filter.status);

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
  } else {
    items = services.map((service) => (
      <ServiceRow
        key={service.id}
        service={service}
        categoryName={categoryNameById.get(service.categoryId) ?? "—"}
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
        icon={<Tag className="size-8" />}
        title="Nenhum serviço cadastrado ainda."
        description="Cadastre os serviços do seu catálogo para usá-los nos agendamentos."
        actionLabel={canManage ? "Cadastrar serviço" : undefined}
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
              placeholder="Buscar por nome ou descrição..."
              className="px-8"
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
      }
    />
  );
}
