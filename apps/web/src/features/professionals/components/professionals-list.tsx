"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Contact,
  Pencil,
  Phone,
  Power,
  PowerOff,
  RotateCw,
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
  StatusFilterSelect,
  ViewModeSkeleton,
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
import { formatPhone, plural } from "@gestarahub/core/format";
import type {
  ProfessionalFilter,
  ProfessionalView,
  RecordStatus,
} from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useProfessionals } from "../hooks/use-professionals";

interface ProfessionalsListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (professional: ProfessionalView) => void;
  onInactivate: (professional: ProfessionalView) => void;
  onReactivate: (professional: ProfessionalView) => void;
}

function ProfessionalRow({
  professional,
  canManage,
  isClasses,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  professional: ProfessionalView;
  canManage: boolean;
  isClasses: boolean;
  onEdit: (p: ProfessionalView) => void;
  onInactivate: (p: ProfessionalView) => void;
  onReactivate: (p: ProfessionalView) => void;
}) {
  const isActive = professional.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
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
      ]
    : [];

  const activityMeta = isClasses
    ? plural((professional.modalityIds ?? []).length, "modalidade", "modalidades")
    : plural(professional.serviceIds.length, "serviço", "serviços");

  const content = (
    <ListRow
      onClick={() => onEdit(professional)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do profissional"
            ariaLabel={`Ações de ${professional.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <InitialsAvatar name={professional.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {professional.name}
            </p>
            {professional.role?.name ? (
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {professional.role.name}
              </span>
            ) : null}
            <RecordStatusBadge status={professional.status} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-3 text-muted-foreground/60" />
              <span>{activityMeta}</span>
            </span>
            {!isClasses && professional.workingHours.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3 text-muted-foreground/60" />
                <span>
                  {professional.workingHours.length}{" "}
                  {professional.workingHours.length === 1
                    ? "dia de atendimento"
                    : "dias de atendimento"}
                </span>
              </span>
            ) : null}
            {professional.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground/60" />
                <span>{formatPhone(professional.phone)}</span>
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

function ProfessionalCard({
  professional,
  canManage,
  isClasses,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  professional: ProfessionalView;
  canManage: boolean;
  isClasses: boolean;
  onEdit: (p: ProfessionalView) => void;
  onInactivate: (p: ProfessionalView) => void;
  onReactivate: (p: ProfessionalView) => void;
}) {
  const isActive = professional.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
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
      ]
    : [];

  const activityMeta = isClasses
    ? plural((professional.modalityIds ?? []).length, "modalidade", "modalidades")
    : plural(professional.serviceIds.length, "serviço", "serviços");

  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={() => canManage && onEdit(professional)}
      onKeyDown={(e) => {
        if (!canManage) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(professional);
        }
      }}
      className={cn(
        "group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={professional.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {professional.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {professional.role?.name ? (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {professional.role.name}
                </span>
              ) : null}
              <RecordStatusBadge status={professional.status} />
            </div>
          </div>
        </div>

        {canManage ? (
          <div
            className="-mr-2 -mt-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ListItemActionsMenu
              actions={actions}
              title="Ações do profissional"
              ariaLabel={`Ações de ${professional.name}`}
              variant="ghost"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="size-3.5 text-muted-foreground/60" />
          <span>{activityMeta}</span>
        </span>
        {professional.phone ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Phone className="size-3.5 text-muted-foreground/60" />
            <span>{formatPhone(professional.phone)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
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
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-3 w-44 max-w-full" />
        </div>
      </div>
      {showAction ? (
        <div className="flex size-8 shrink-0 items-center justify-center">
          <Skeleton className="h-4 w-1.5 rounded-full" />
        </div>
      ) : null}
    </div>
  ));
}

function ProfessionalSkeletonCards({ showAction }: { showAction: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-4 w-32 max-w-full rounded-full" />
              </div>
            </div>
            {showAction ? (
              <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                <Skeleton className="h-4 w-1.5 rounded-full" />
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfessionalsList({
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: ProfessionalsListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const [viewMode, setViewMode] = useViewMode("professionals", "list");
  const isClasses = useModel() === "classes";

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
    items = [<SkeletonRows key="skeleton" showAction={canManage} />];
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
  } else if (professionals.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Contact className="size-8" />}
            title="Nenhum profissional cadastrado ainda."
            description={
              isClasses
                ? "Cadastre sua equipe, as modalidades que cada um leciona e a disponibilidade."
                : "Cadastre sua equipe, os serviços que cada um realiza e a disponibilidade."
            }
          />
        }
      />
    );
  } else {
    items = professionals.map((professional) => (
      <ProfessionalRow
        key={professional.id}
        professional={professional}
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
          onClear={clearSearch}
          placeholder="Buscar por nome ou cargo..."
          aria-label="Buscar profissional"
        />

        <div className="flex items-center gap-2">
          <StatusFilterSelect
            value={status}
            onChange={setStatus}
            gender="male"
          />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Contador / Resumo */}
      {!isError ? (
        <ListSummaryBar
          isLoading={isPending}
          count={professionals.length}
          singularLabel="profissional na equipe"
          pluralLabel="profissionais na equipe"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista ou Grade de Cards */}
      {isPending ? (
        <ViewModeSkeleton
          storageKey="professionals"
          mode={viewMode}
          list={
            <ListContainer>
              <SkeletonRows showAction={canManage} />
            </ListContainer>
          }
          grid={<ProfessionalSkeletonCards showAction={canManage} />}
        />
      ) : !isError && professionals.length > 0 && viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => (
            <ProfessionalCard
              key={professional.id}
              professional={professional}
              canManage={canManage}
              isClasses={isClasses}
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
