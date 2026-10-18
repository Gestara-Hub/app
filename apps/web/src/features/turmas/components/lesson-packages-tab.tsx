"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Power, PowerOff, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { LessonPackage, RecordStatus } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents, plural } from "@gestarahub/core/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useCan } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useLessonPackages, useUpdateLessonPackage } from "../hooks/use-packages";
import { useClassGroups } from "../hooks/use-turmas";
import { PackageFormDialog } from "./package-form-dialog";

const DEFAULT_STATUS: "all" | RecordStatus = "active";

/** "Sem validade", "Vale 30 dias" ou "Vale 1 ano". */
function validityLabel(days?: number): string {
  if (!days) return "Sem validade";
  return days === 365 ? "Vale 1 ano" : `Vale ${days} dias`;
}

function PackageRow({
  pkg,
  modalities,
  canManage,
  onEdit,
  onToggleStatus,
}: {
  pkg: LessonPackage;
  modalities: string;
  canManage: boolean;
  onEdit: (pkg: LessonPackage) => void;
  onToggleStatus: (pkg: LessonPackage) => void;
}) {
  const isActive = pkg.status === "active";
  const actions: ListItemAction[] = canManage
    ? [
        { key: "edit", label: "Editar", icon: <Pencil className="size-4" />, onSelect: () => onEdit(pkg) },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onToggleStatus(pkg),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onToggleStatus(pkg),
            },
      ]
    : [];

  const content = (
    <ListRow
      onClick={() => onEdit(pkg)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu actions={actions} title={`Ações de ${pkg.name}`} variant="ghost" />
        ) : null
      }
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {pkg.name}
            </p>
            <RecordStatusBadge status={pkg.status} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span>{validityLabel(pkg.validityDays)}</span>
            <span>·</span>
            <span>{modalities}</span>
            {pkg.absenceConsumes ? null : (
              <>
                <span>·</span>
                <span>Falta não gasta</span>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{formatCents(pkg.priceCents)}</p>
          <p className="text-xs text-muted-foreground">{plural(pkg.lessons, "aula", "aulas")}</p>
        </div>
      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

/** Versao em cartao do pacote (visao "Cartões"), com as mesmas acoes da linha. */
function PackageCard({
  pkg,
  modalities,
  canManage,
  onEdit,
  onToggleStatus,
}: {
  pkg: LessonPackage;
  modalities: string;
  canManage: boolean;
  onEdit: (pkg: LessonPackage) => void;
  onToggleStatus: (pkg: LessonPackage) => void;
}) {
  const isActive = pkg.status === "active";
  const actions: ListItemAction[] = canManage
    ? [
        { key: "edit", label: "Editar", icon: <Pencil className="size-4" />, onSelect: () => onEdit(pkg) },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onToggleStatus(pkg),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onToggleStatus(pkg),
            },
      ]
    : [];

  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={() => canManage && onEdit(pkg)}
      onKeyDown={(e) => {
        if (!canManage) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(pkg);
        }
      }}
      className={cn(
        "group flex h-full flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <RecordStatusBadge status={pkg.status} />
          <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{pkg.name}</p>
          <p className="text-xs text-muted-foreground">
            {validityLabel(pkg.validityDays)} · {modalities}
            {pkg.absenceConsumes ? "" : " · Falta não gasta"}
          </p>
        </div>
        {canManage ? (
          <div className="-mr-2 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <ListItemActionsMenu actions={actions} title={`Ações de ${pkg.name}`} variant="ghost" />
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border/50 pt-3">
        <span className="text-xs text-muted-foreground">{plural(pkg.lessons, "aula", "aulas")}</span>
        <span className="text-base font-bold tabular-nums text-foreground">{formatCents(pkg.priceCents)}</span>
      </div>
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-4 shadow-2xs">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-48 max-w-full" />
          <div className="flex justify-between border-t border-border/50 pt-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  ));
}

/**
 * Aba "Pacotes de aulas" da tela Planos: o catalogo que o espaco vende aos
 * alunos (venda pelo menu do aluno em Alunos).
 */
export function LessonPackagesTab({
  creating,
  onCreatingChange,
}: {
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>(DEFAULT_STATUS);
  const [viewMode, setViewMode] = useViewMode("packages", "list");
  const { data, isPending } = useLessonPackages({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const { data: categories } = useCategories();
  const { data: classGroups } = useClassGroups();
  const can = useCan();
  const canManage = can("billing:manage");
  const updateMut = useUpdateLessonPackage();
  const { confirm, dialog: confirmDialog } = useConfirmAction();

  const [editing, setEditing] = useState<LessonPackage | null>(null);
  const formOpen = creating || editing !== null;
  const setFormOpen = (open: boolean) => {
    if (open) return;
    setEditing(null);
    onCreatingChange(false);
  };

  const nameById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);
  const classNameById = useMemo(() => new Map((classGroups ?? []).map((g) => [g.id, g.name])), [classGroups]);
  // Onde vale: turmas escolhidas; pacote antigo mostra as modalidades.
  const modalitiesOf = (pkg: LessonPackage) =>
    pkg.classGroupIds?.length
      ? pkg.classGroupIds.map((id) => classNameById.get(id)).filter(Boolean).join(", ") || "Turma removida"
      : pkg.modalityIds.length === 0
        ? "Todas as turmas"
        : pkg.modalityIds.map((id) => nameById.get(id)).filter(Boolean).join(", ") || "Modalidade removida";

  const packages = [...(data ?? [])].sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      a.lessons - b.lessons ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const hasSearch = Boolean(search.trim());
  const hasFilters = status !== DEFAULT_STATUS;
  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus(DEFAULT_STATUS);
  };

  async function toggleStatus(pkg: LessonPackage) {
    const inactivating = pkg.status === "active";
    const ok = await confirm({
      title: inactivating ? "Inativar pacote?" : "Reativar pacote?",
      description: inactivating
        ? `“${pkg.name}” deixa de aparecer na venda. Quem já comprou continua usando.`
        : `“${pkg.name}” volta a aparecer na venda.`,
      confirmLabel: inactivating ? "Inativar" : "Reativar",
      variant: inactivating ? "destructive" : "default",
    });
    if (!ok) return;
    try {
      await updateMut.mutateAsync({ id: pkg.id, payload: { status: inactivating ? "inactive" : "active" } });
      toast.success(inactivating ? `Pacote "${pkg.name}" inativado.` : `Pacote "${pkg.name}" reativado.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível salvar o pacote."));
    }
  }

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;
  if (isPending) {
    items = [<SkeletonRows key="skeleton" />];
  } else if (packages.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Ticket className="size-8" />}
            title="Nenhum pacote de aulas ainda."
            description="Para quem compra um número de aulas. Dá para usar junto com mensalidades."
          />
        }
      />
    );
  } else {
    items = packages.map((pkg) => (
      <PackageRow
        key={pkg.id}
        pkg={pkg}
        modalities={modalitiesOf(pkg)}
        canManage={canManage}
        onEdit={setEditing}
        onToggleStatus={(p) => void toggleStatus(p)}
      />
    ));
  }

  return (
    <>
      {confirmDialog}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Buscar pacote..."
            value={search}
            onChange={setSearch}
            onClear={clearSearch}
            aria-label="Buscar pacote"
          />
          <div className="flex items-center gap-2">
            <StatusFilterSelect value={status} onChange={setStatus} gender="male" />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        <ListSummaryBar
          isLoading={isPending}
          count={packages.length}
          singularLabel="pacote cadastrado"
          pluralLabel="pacotes cadastrados"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />

        {isPending ? (
          <ViewModeSkeleton
            storageKey="packages"
            mode={viewMode}
            list={
              <ListContainer>
                <SkeletonRows />
              </ListContainer>
            }
            grid={<SkeletonCards />}
          />
        ) : packages.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                modalities={modalitiesOf(pkg)}
                canManage={canManage}
                onEdit={setEditing}
                onToggleStatus={(p) => void toggleStatus(p)}
              />
            ))}
          </div>
        ) : (
          <ListContainer emptyState={emptyState}>{items}</ListContainer>
        )}
      </div>

      <PackageFormDialog open={formOpen} onOpenChange={setFormOpen} pkg={editing} />
    </>
  );
}
