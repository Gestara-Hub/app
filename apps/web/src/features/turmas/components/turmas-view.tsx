"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import {
  CalendarRange,
  Clock,
  GraduationCap,
  Pencil,
  Plus,
  Power,
  PowerOff,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  RecordStatusBadge,
  SearchInput,
  StatusFilterSelect,
} from "@/components/shared/list";
import { cn } from "@/lib/utils";
import type { ClassGroupView, ClassMeetingSlot, RecordStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useClassGroups,
  useDeactivateClassGroup,
  useReactivateClassGroup,
} from "../hooks/use-turmas";
import { TurmaFormDialog } from "./turma-form-dialog";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function slotsSummary(slots: ClassMeetingSlot[]): string {
  return slots
    .map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.start}`)
    .join(" · ");
}

function TurmaRow({
  turma,
  canManage,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  canManage: boolean;
  onDeactivate: (turma: ClassGroupView) => void;
  onReactivate: (turma: ClassGroupView) => void;
}) {
  const router = useRouter();
  const isActive = turma.status === "active";
  const full = turma.vagasRestantes <= 0;

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => router.push(`/classes/${turma.id}`),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Desativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onDeactivate(turma),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(turma),
            },
      ]
    : [];

  const content = (
    <ListRow
      onClick={() => router.push(`/classes/${turma.id}`)}
      canClick
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações da turma"
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {turma.name}
        </p>
        {turma.modalityName ? (
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {turma.modalityName}
          </span>
        ) : null}
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
            full
              ? "border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400"
              : "border-border/60 bg-muted/50 text-muted-foreground",
          )}
        >
          {turma.enrolledCount}/{turma.capacity} vagas
        </span>
        <RecordStatusBadge status={turma.status} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {turma.instructorName ? (
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3 text-muted-foreground/60" />
            <span>{turma.instructorName}</span>
          </span>
        ) : null}
        {turma.meetingSlots.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground/60" />
            <span>{slotsSummary(turma.meetingSlots)}</span>
          </span>
        ) : null}
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
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function TurmasView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const { data: turmas, isLoading } = useClassGroups({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const can = useCan();
  const canManage = can("classes:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivatingTurma, setDeactivatingTurma] = useState<ClassGroupView | null>(null);

  const deactivate = useDeactivateClassGroup();
  const reactivate = useReactivateClassGroup();

  const hasSearch = Boolean(search.trim());
  const hasFilters = status !== "all";

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  const turmaList = turmas ?? [];

  const handleDeactivate = async () => {
    if (!deactivatingTurma) return;
    try {
      await deactivate.mutateAsync(deactivatingTurma.id);
      toast.success(`Turma "${deactivatingTurma.name}" desativada.`);
      setDeactivatingTurma(null);
    } catch {
      toast.error("Não foi possível desativar a turma.");
    }
  };

  const handleReactivate = async (turma: ClassGroupView) => {
    try {
      await reactivate.mutateAsync(turma.id);
      toast.success(`Turma "${turma.name}" reativada.`);
    } catch {
      toast.error("Não foi possível reativar a turma.");
    }
  };

  return (
    <>
      <PageHeader
        title="Turmas"
        description="Turmas, matrículas e frequência dos alunos."
      >
        <Button asChild variant="outline">
          <Link href="/classes/calendar">
            <CalendarRange className="size-4" />
            Calendário
          </Link>
        </Button>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nova turma
          </Button>
        ) : null}
      </PageHeader>

      <TurmaFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmActionDialog
        open={deactivatingTurma !== null}
        onOpenChange={(open) => !open && setDeactivatingTurma(null)}
        title="Desativar turma?"
        description={
          deactivatingTurma ? (
            <>
              Tem certeza que deseja desativar <strong>&ldquo;{deactivatingTurma.name}&rdquo;</strong>?
              <br />
              <br />
              Isso não deletará os dados — apenas impedirá novas aulas. O histórico
              de frequência e matrículas será preservado.
            </>
          ) : null
        }
        confirmLabel="Desativar"
        isPending={deactivate.isPending}
        onConfirm={handleDeactivate}
      />

      <div className="space-y-4">
        {/* Barra de Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Buscar turma..."
            value={search}
            onChange={setSearch}
            onClear={clearSearch}
            aria-label="Buscar turma"
          />
          <StatusFilterSelect
            value={status}
            onChange={setStatus}
            gender="female"
          />
        </div>

        {/* Contador / Resumo */}
        {!isLoading && turmaList.length > 0 ? (
          <ListSummaryBar
            count={turmaList.length}
            singularLabel="turma cadastrada"
            pluralLabel="turmas cadastradas"
            hasFilters={hasSearch || hasFilters}
            onClearFilters={clearAll}
          />
        ) : null}

        {/* Container Unificado da Lista */}
        <ListContainer
          emptyState={
            turmaList.length === 0 && !isLoading ? (
              <ListEmptyState
                hasSearch={hasSearch}
                hasFilters={hasFilters}
                onClearSearch={clearSearch}
                onClearFilters={clearAll}
                emptyGuide={
                  <ModuleEmptyGuide
                    icon={<GraduationCap className="size-8" />}
                    title="Nenhuma turma cadastrada ainda."
                    description="Cadastre turmas para organizar horários, matrículas e frequência dos alunos."
                    actionLabel={canManage ? "Nova turma" : undefined}
                    onAction={canManage ? () => setCreateOpen(true) : undefined}
                  />
                }
              />
            ) : null
          }
        >
          {isLoading ? (
            <SkeletonRows showAction={canManage} />
          ) : (
            turmaList.map((t) => (
              <TurmaRow
                key={t.id}
                turma={t}
                canManage={canManage}
                onDeactivate={setDeactivatingTurma}
                onReactivate={handleReactivate}
              />
            ))
          )}
        </ListContainer>
      </div>
    </>
  );
}
