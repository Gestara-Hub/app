"use client";

import { useState, type ReactNode } from "react";
import {
  CreditCard,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const PERIOD_LABELS: Record<string, string> = {
  monthly: "Mensal",
  biweekly: "Quinzenal",
  weekly: "Semanal",
  session: "Por aula",
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
            title="Ações do plano"
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {plan.name}
          </p>
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {PERIOD_LABELS[plan.period] || "Mensal"}
          </span>
          <RecordStatusBadge status={plan.status} />
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="size-3 text-muted-foreground/60" />
          <span>{formatCents(plan.priceCents)}</span>
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
      <div className="space-y-1.5 min-w-0 flex-1">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-28" />
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function PlansView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const { data: allPlans, isLoading } = usePlans({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const plans = allPlans ?? [];

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
            actionLabel={canManage ? "Novo plano" : undefined}
            onAction={canManage ? openNew : undefined}
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
          <Button onClick={openNew}>
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

          <StatusFilterSelect
            value={status}
            onChange={setStatus}
            gender="male"
          />
        </div>

        {/* Contador / Resumo */}
        {!isLoading && plans.length > 0 ? (
          <ListSummaryBar
            count={plans.length}
            singularLabel="plano cadastrado"
            pluralLabel="planos cadastrados"
            hasFilters={hasSearch || hasFilters}
            onClearFilters={clearAll}
          />
        ) : null}

        {/* Container Unificado da Lista */}
        <ListContainer emptyState={emptyState}>
          {items}
        </ListContainer>
      </div>

      {/* Dialog Criar / Editar Plano */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
          expandable
          storageKey="plan"
        >
          <DialogHeader className="pr-14">
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>Nome e valor do plano.</DialogDescription>
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

