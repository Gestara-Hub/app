"use client";

import { useState, type ReactNode } from "react";
import {
  CreditCard,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/page-header";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { formatCents } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { cn } from "@/lib/utils";
import { recordStatusLabel } from "@/lib/labels";
import type { Plano, RecordStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useInactivatePlan,
  usePlans,
  useReactivatePlan,
} from "../hooks/use-billing";
import { PlanForm } from "./plan-form";

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

function PlanRow({
  plan,
  canManage,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  plan: Plano;
  canManage: boolean;
  onEdit: (p: Plano) => void;
  onInactivate: (p: Plano) => void;
  onReactivate: (p: Plano) => void;
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
    <div
      onClick={() => canManage && onEdit(plan)}
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onKeyDown={(e) => {
        if (canManage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit(plan);
        }
      }}
      className={cn(
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40",
        canManage && "cursor-pointer",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {plan.name}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
              statusPillClass(isActive),
            )}
          >
            {recordStatusLabel(plan.status)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="size-3 text-muted-foreground/60" />
          <span>{formatCents(plan.priceCents)} / mês</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do plano"
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

  const [editing, setEditing] = useState<Plano | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inactivating, setInactivating] = useState<Plano | null>(null);

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
  const openEdit = (p: Plano) => {
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

  const handleReactivate = async (p: Plano) => {
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
          icon={<Layers className="size-8" />}
          title="Nenhum plano cadastrado ainda."
          description="Cadastre os planos de mensalidade usados pelas turmas."
          actionLabel={canManage ? "Novo plano" : undefined}
          onAction={canManage ? openNew : undefined}
        />
      </div>
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
      <PageHeader
        title="Planos"
        description="Planos de mensalidade usados pelas turmas."
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
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar plano..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
              autoComplete="off"
              aria-label="Buscar plano"
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
            onValueChange={(val) => setStatus(val as "all" | RecordStatus)}
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
        {!isLoading && plans.length > 0 ? (
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              {plans.length === 1
                ? "1 plano cadastrado"
                : `${plans.length} planos cadastrados`}
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

      {/* Dialog Criar / Editar Plano */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>Nome e valor mensal do plano.</DialogDescription>
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
      <AlertDialog
        open={inactivating !== null}
        onOpenChange={(open) => !open && setInactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar plano?</AlertDialogTitle>
            <AlertDialogDescription>
              {inactivating ? (
                <>
                  O plano &ldquo;{inactivating.name}&rdquo; não poderá mais ser
                  vinculado a novas turmas. Você pode reativá-lo a qualquer
                  momento.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inactivateMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleInactivate}
              disabled={inactivateMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {inactivateMut.isPending ? "Inativando..." : "Inativar plano"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

