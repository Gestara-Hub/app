"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Scissors,
  Search,
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
import { formatPhone } from "@/lib/format";
import { recordStatusLabel } from "@/lib/labels";
import type {
  ProfessionalFilter,
  ProfessionalView,
  RecordStatus,
} from "@/types";
import { useProfessionals } from "../hooks/use-professionals";

interface ProfessionalsListProps {
  onCreate: () => void;
  onEdit: (professional: ProfessionalView) => void;
  onInactivate: (professional: ProfessionalView) => void;
  onReactivate: (professional: ProfessionalView) => void;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
}

function ProfessionalRow({
  professional,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  professional: ProfessionalView;
  onEdit: (p: ProfessionalView) => void;
  onInactivate: (p: ProfessionalView) => void;
  onReactivate: (p: ProfessionalView) => void;
}) {
  const isActive = professional.status === "active";

  const actions: ListItemAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: <Pencil className="size-4" />,
      onSelect: () => onEdit(professional),
    },
    isActive
      ? {
          key: "inactivate",
          label: "Inativar",
          icon: <PowerOff className="size-4" />,
          onSelect: () => onInactivate(professional),
          destructive: true,
        }
      : {
          key: "reactivate",
          label: "Reativar",
          icon: <Power className="size-4" />,
          onSelect: () => onReactivate(professional),
        },
  ];

  const meta = [
    professional.role.name,
    `${professional.serviceIds.length} serviços`,
    `${professional.workingHours.length} dias de atendimento`,
    professional.phone ? formatPhone(professional.phone) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <ListItemCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{professional.name}</p>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(professional.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        </div>
        <ListItemActionsMenu actions={actions} title="Ações do profissional" />
      </div>
    </ListItemCard>
  );

  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  ));
}

export function ProfessionalsList({
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ProfessionalsListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const filter: ProfessionalFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useProfessionals(filter);
  const professionals = data ?? [];

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
    items = [<SkeletonRows key="skeleton" />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a equipe. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else {
    items = professionals.map((professional) => (
      <ProfessionalRow
        key={professional.id}
        professional={professional}
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
        icon={<Scissors className="size-8" />}
        title="Nenhum profissional cadastrado ainda."
        description="Cadastre sua equipe, os serviços que cada um realiza e a disponibilidade."
        actionLabel="Cadastrar profissional"
        onAction={onCreate}
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
              placeholder="Buscar por nome ou cargo..."
              className="px-8"
              autoComplete="off"
              aria-label="Buscar profissional"
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
