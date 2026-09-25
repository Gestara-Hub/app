"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Mail, Pencil, Phone, Power, PowerOff, RotateCw, Users, Wallet } from "lucide-react";
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
  ViewModeCoachmark,
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
import { formatCents, formatPhone } from "@gestarahub/core/format";
import type { Client, ClientFilter, Plan, PlanPeriod, RecordStatus } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { usePlans } from "@/features/turmas";
import { useClients } from "../hooks/use-clients";

const PERIOD_SHORT: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

const PERIOD_BADGE_CLASSES: Record<PlanPeriod, string> = {
  monthly:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  biweekly:
    "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  weekly:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

function getEffectivePriceCents(client: Client, plan: Plan): number {
  let price = plan.priceCents;
  if (client.discount && client.discount.value > 0) {
    if (client.discount.type === "percentage") {
      price = Math.max(0, price - Math.round((price * client.discount.value) / 100));
    } else {
      price = Math.max(0, price - Math.round(client.discount.value));
    }
  }
  return price;
}

function ClientPlanBadge({ client, plan }: { client: Client; plan?: Plan }) {
  if (!client.planId || !plan) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        Sem plano (Avulso)
      </span>
    );
  }

  const period = plan.period ?? "monthly";
  const cleanName = plan.name
    .replace(/^(Mensal|Quinzenal|Semanal)\s*[-–—:]\s*/i, "")
    .trim();
  const effectiveCents = getEffectivePriceCents(client, plan);
  const hasDiscount = effectiveCents < plan.priceCents;
  const isPaused = client.membershipStatus === "paused";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isPaused
          ? "bg-muted text-muted-foreground border-border"
          : PERIOD_BADGE_CLASSES[period],
      )}
    >
      <Wallet className="size-3 shrink-0 opacity-75" />
      <span className="truncate max-w-[14rem]">{cleanName}</span>
      <span className="opacity-50">•</span>
      <span className="font-semibold tabular-nums">
        {formatCents(effectiveCents)}/{PERIOD_SHORT[period]}
      </span>
      {hasDiscount ? (
        <span className="rounded bg-background/60 px-1 py-0.2 text-[10px] font-bold">
          {client.discount?.type === "percentage"
            ? `-${client.discount.value}%`
            : "desc."}
        </span>
      ) : null}
      {isPaused ? (
        <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          Trancado
        </span>
      ) : null}
    </span>
  );
}

interface ClientsListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  onInactivate: (client: Client) => void;
  onReactivate: (client: Client) => void;
}

function ClientRow({
  client,
  plan,
  canManage,
  isClasses,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  plan?: Plan;
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
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <InitialsAvatar name={client.name} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
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

            {isClasses ? (
              <div className="mt-2 sm:hidden">
                <ClientPlanBadge client={client} plan={plan} />
              </div>
            ) : null}
          </div>
        </div>

        {isClasses ? (
          <div className="hidden sm:flex items-center shrink-0">
            <ClientPlanBadge client={client} plan={plan} />
          </div>
        ) : null}
      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function ClientCard({
  client,
  plan,
  canManage,
  isClasses,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  plan?: Plan;
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

  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={() => canManage && onEdit(client)}
      onKeyDown={(e) => {
        if (!canManage) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(client);
        }
      }}
      className={cn(
        "group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar name={client.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {client.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <RecordStatusBadge status={client.status} />
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
                title={isClasses ? "Ações do aluno" : "Ações do cliente"}
                ariaLabel={`Ações de ${client.name}`}
                variant="ghost"
              />
            </div>
          ) : null}
        </div>

        {isClasses ? (
          <div>
            <ClientPlanBadge client={client} plan={plan} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        {client.phone ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Phone className="size-3.5 text-muted-foreground/60" />
            <span>{formatPhone(client.phone)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">Sem telefone</span>
        )}
        {client.email ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            <Mail className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate">{client.email}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonRows({
  showAction,
  isClasses,
}: {
  showAction: boolean;
  isClasses: boolean;
}) {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="space-y-1.5 min-w-0 flex-1">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-28 max-w-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isClasses ? (
          <Skeleton className="hidden h-5 w-44 rounded-full sm:block" />
        ) : null}
        {showAction ? (
          <div className="flex size-8 shrink-0 items-center justify-center">
            <Skeleton className="h-4 w-1.5 rounded-full" />
          </div>
        ) : null}
      </div>
    </div>
  ));
}

function ClientSkeletonCards({
  showAction,
  isClasses,
}: {
  showAction: boolean;
  isClasses: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </div>
              {showAction ? (
                <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                  <Skeleton className="h-4 w-1.5 rounded-full" />
                </div>
              ) : null}
            </div>
            {isClasses ? (
              <Skeleton className="h-5 w-48 max-w-full rounded-full" />
            ) : null}
          </div>
          <div className="mt-4 border-t border-border/50 pt-3">
            <Skeleton className="h-3.5 w-28 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientsList({
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: ClientsListProps) {
  const isClasses = useModel() === "classes";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const [viewMode, setViewMode] = useViewMode("clients", "list");

  const filter: ClientFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useClients(filter);
  const { data: plans } = usePlans();
  const clients = data ?? [];

  const planById = useMemo(
    () => new Map((plans ?? []).map((p) => [p.id, p])),
    [plans],
  );

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
    items = [
      <SkeletonRows
        key="skeleton"
        showAction={canManage}
        isClasses={isClasses}
      />,
    ];
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
          />
        }
      />
    );
  } else {
    items = clients.map((client) => (
      <ClientRow
        key={client.id}
        client={client}
        plan={client.planId ? planById.get(client.planId) : undefined}
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
          placeholder="Buscar por nome ou telefone..."
          aria-label={isClasses ? "Buscar aluno" : "Buscar cliente"}
        />
        <div className="flex items-center gap-2">
          <StatusFilterSelect value={status} onChange={setStatus} />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <ViewModeCoachmark
            storageKey="clients"
            itemCount={clients.length}
            threshold={3}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {/* Contador / Resumo */}
      {!isError ? (
        <ListSummaryBar
          isLoading={isPending}
          count={clients.length}
          singularLabel={isClasses ? "aluno cadastrado" : "cliente cadastrado"}
          pluralLabel={isClasses ? "alunos cadastrados" : "clientes cadastrados"}
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista ou Grade de Cards */}
      {isPending ? (
        <ViewModeSkeleton
          storageKey="clients"
          mode={viewMode}
          list={
            <ListContainer>
              <SkeletonRows showAction={canManage} isClasses={isClasses} />
            </ListContainer>
          }
          grid={
            <ClientSkeletonCards
              showAction={canManage}
              isClasses={isClasses}
            />
          }
        />
      ) : !isError && clients.length > 0 && viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              plan={client.planId ? planById.get(client.planId) : undefined}
              canManage={canManage}
              isClasses={isClasses}
              onEdit={onEdit}
              onInactivate={onInactivate}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      ) : (
        <ListContainer emptyState={emptyState}>{items}</ListContainer>
      )}
    </div>
  );
}

