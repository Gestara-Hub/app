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
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { formatPhone } from "@gestarahub/core/format";
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
    ? `${(professional.modalityIds ?? []).length} ${(professional.modalityIds ?? []).length === 1 ? "modalidade" : "modalidades"}`
    : `${professional.serviceIds.length} ${professional.serviceIds.length === 1 ? "serviço" : "serviços"}`;

  const content = (
    <ListRow
      onClick={() => onEdit(professional)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do profissional"
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
            {professional.workingHours.length > 0 ? (
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

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="space-y-1.5 min-w-0 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function ProfessionalsList({
  canManage,
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ProfessionalsListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
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
            actionLabel={canManage ? "Cadastrar profissional" : undefined}
            onAction={canManage ? onCreate : undefined}
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

        <StatusFilterSelect
          value={status}
          onChange={setStatus}
          gender="male"
        />
      </div>

      {/* Contador / Resumo */}
      {!isPending && !isError && professionals.length > 0 ? (
        <ListSummaryBar
          count={professionals.length}
          singularLabel="profissional na equipe"
          pluralLabel="profissionais na equipe"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista */}
      <ListContainer emptyState={emptyState}>
        {items}
      </ListContainer>
    </div>
  );
}
