"use client";

import { useState, type ReactNode } from "react";
import {
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { PageHeader } from "@/components/layout/page-header";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import {
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
import { formatCents } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Plan, RecordStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useInactivatePlan,
  usePlans,
  useReactivatePlan,
} from "../hooks/use-billing";
import { PlanForm } from "./plan-form";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

const PERIOD_META: Record<
  string,
  { label: string; suffix: string; order: number; badgeClass: string }
> = {
  monthly: {
    label: "Mensal",
    suffix: "/mês",
    order: 1,
    badgeClass:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  },
  biweekly: {
    label: "Quinzenal",
    suffix: "/quinzena",
    order: 2,
    badgeClass:
      "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  },
  weekly: {
    label: "Semanal",
    suffix: "/semana",
    order: 3,
    badgeClass:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },
  session: {
    label: "Por aula",
    suffix: "/aula",
    order: 4,
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
};

function PlanRow({
  plan,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  plan: Plan;
  canManage: boolean;
  onEdit: (p: Plan) => void;
  onInactivate: (p: Plan) => void;
  onReactivate: (p: Plan) => void;
}) {
  const isActive = plan.status === "active";
  const meta = PERIOD_META[plan.period] ?? PERIOD_META.monthly;

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(plan),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(plan),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(plan),
            },
      ]
    : [];

  const content = (
    <ListRow
      onClick={() => onEdit(plan)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title={`Ações de ${plan.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {plan.name}
            </p>
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                  meta.badgeClass,
                )}
              >
                {meta.label}
              </span>
              <RecordStatusBadge status={plan.status} />
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5 sm:hidden">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0 text-[11px] font-medium",
                meta.badgeClass,
              )}
            >
              {meta.label}
            </span>
            <RecordStatusBadge status={plan.status} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatCents(plan.priceCents)}
          </span>
          <span className="ml-0.5 text-xs text-muted-foreground">
            {meta.suffix}
          </span>
        </div>
      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function PlanCard({
  plan,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  plan: Plan;
  canManage: boolean;
  onEdit: (p: Plan) => void;
  onInactivate: (p: Plan) => void;
  onReactivate: (p: Plan) => void;
}) {
  const isActive = plan.status === "active";
  const meta = PERIOD_META[plan.period] ?? PERIOD_META.monthly;

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(plan),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(plan),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(plan),
            },
      ]
    : [];

  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={() => canManage && onEdit(plan)}
      onKeyDown={(e) => {
        if (!canManage) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(plan);
        }
      }}
      className={cn(
        "group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                meta.badgeClass,
              )}
            >
              {meta.label}
            </span>
            <RecordStatusBadge status={plan.status} />
          </div>
          <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
            {plan.name}
          </p>
        </div>
        {canManage ? (
          <div
            className="-mr-2 -mt-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ListItemActionsMenu
              actions={actions}
              title={`Ações de ${plan.name}`}
              variant="ghost"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-end border-t border-border/50 pt-3">
        <div>
          <span className="text-base font-bold tabular-nums text-foreground">
            {formatCents(plan.priceCents)}
          </span>
          <span className="ml-0.5 text-xs text-muted-foreground">
            {meta.suffix}
          </span>
        </div>
      </div>
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 6 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="min-w-0 flex-1 py-1">
        <Skeleton className="h-4 w-52 max-w-full" />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Skeleton className="h-4 w-24" />
        {showAction ? (
          <div className="flex size-8 shrink-0 items-center justify-center">
            <Skeleton className="h-4 w-1.5 rounded-full" />
          </div>
        ) : null}
      </div>
    </div>
  ));
}

function PlanSkeletonCards({ showAction }: { showAction: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
            {showAction ? (
              <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                <Skeleton className="h-4 w-1.5 rounded-full" />
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-baseline justify-end border-t border-border/50 pt-3">
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlansView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const [viewMode, setViewMode] = useViewMode("plans", "list");

  const { data: allPlans, isLoading } = usePlans({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const plans = [...(allPlans ?? [])].sort((a, b) => {
    const statusDiff =
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
    if (statusDiff !== 0) return statusDiff;

    const orderA = PERIOD_META[a.period]?.order ?? 99;
    const orderB = PERIOD_META[b.period]?.order ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    if (a.priceCents !== b.priceCents) return a.priceCents - b.priceCents;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const can = useCan();
  const canManage = can("billing:manage");

  const [editing, setEditing] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inactivating, setInactivating] = useState<Plan | null>(null);

  const inactivateMut = useInactivatePlan();
  const reactivateMut = useReactivatePlan();

  const hasSearch = Boolean(search.trim());
  const hasFilters = status !== "all";

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleInactivate = async () => {
    if (!inactivating) return;
    try {
      await inactivateMut.mutateAsync(inactivating.id);
      toast.success(`Plano "${inactivating.name}" inativado.`);
      setInactivating(null);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível inativar o plano."),
      );
    }
  };

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const handleReactivate = async (p: Plan) => {
    if (
      !(await confirmAction({
        title: "Reativar plano?",
        description: `“${p.name}” volta a aparecer no cadastro de alunos.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await reactivateMut.mutateAsync(p.id);
      toast.success(`Plano "${p.name}" reativado.`);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível reativar o plano."),
      );
    }
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isLoading) {
    items = [<SkeletonRows key="skeleton" showAction={canManage} />];
  } else if (plans.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Layers className="size-8" />}
            title="Nenhum plano cadastrado ainda."
            description="Cadastre os planos usados pelas turmas."
          />
        }
      />
    );
  } else {
    items = plans.map((p) => (
      <PlanRow
        key={p.id}
        plan={p}
        canManage={canManage}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={handleReactivate}
      />
    ));
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Planos"
        description="Planos usados pelas turmas."
      >
        {canManage ? (
          <Button onClick={openNew} data-onboarding-cta="plans">
            <Plus className="size-4" />
            Novo plano
          </Button>
        ) : null}
      </PageHeader>

      <div className="space-y-4">
        {/* Barra de Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Buscar plano..."
            value={search}
            onChange={setSearch}
            onClear={clearSearch}
            aria-label="Buscar plano"
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
        <ListSummaryBar
          isLoading={isLoading}
          count={plans.length}
          singularLabel="plano cadastrado"
          pluralLabel="planos cadastrados"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />

        {/* Container Unificado da Lista ou Grade de Cards */}
        {isLoading ? (
          <ViewModeSkeleton
            storageKey="plans"
            mode={viewMode}
            list={
              <ListContainer>
                <SkeletonRows showAction={canManage} />
              </ListContainer>
            }
            grid={<PlanSkeletonCards showAction={canManage} />}
          />
        ) : plans.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                canManage={canManage}
                onEdit={openEdit}
                onInactivate={setInactivating}
                onReactivate={handleReactivate}
              />
            ))}
          </div>
        ) : (
          <ListContainer emptyState={emptyState}>
            {items}
          </ListContainer>
        )}
      </div>

      {/* Dialog Criar / Editar Plano */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="pr-12">
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere o nome, a periodicidade ou o valor."
                : "Será usado para cobrar as mensalidades nas turmas."}
            </DialogDescription>
          </DialogHeader>
          <PlanForm
            key={editing?.id ?? "novo"}
            plan={editing ?? undefined}
            formId="plan-form"
            onSuccess={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de Inativação */}
      <ConfirmActionDialog
        open={inactivating !== null}
        onOpenChange={(open) => !open && setInactivating(null)}
        title="Inativar plano?"
        description={
          inactivating ? (
            <>
              O plano &ldquo;{inactivating.name}&rdquo; deixa de aparecer no
              cadastro de novos alunos. Quem já tem este plano continua sendo
              cobrado normalmente. Você pode reativá-lo a qualquer momento.
            </>
          ) : null
        }
        confirmLabel="Inativar plano"
        isPending={inactivateMut.isPending}
        onConfirm={handleInactivate}
      />
    </>
  );
}

