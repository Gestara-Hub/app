"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
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
import { toast } from "@/lib/toast";
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
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import { classBillingMode } from "@gestarahub/core/billing";
import type { ClassGroupView, ClassMeetingSlot, RecordStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useClassGroups,
  useDeactivateClassGroup,
  useReactivateClassGroup,
} from "../hooks/use-turmas";
import { TurmaFormDrawer } from "./turma-form-drawer";
import { SetupCompleteDialog } from "./setup-complete-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function slotsSummary(slots?: ClassMeetingSlot[]): string {
  return (slots ?? [])
    .map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.start}`)
    .join(" · ");
}

/** Selo de turma ou curso que ja terminou (data de fim no passado). */
export function EndedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
      Encerrado
    </span>
  );
}

/** Selos de cobranca/fim da turma: "Curso", "Pacote" e "Encerrado". */

/**
 * Ocupacao da turma: "3 de 10 alunos"; acima da capacidade, "3 alunos
 * (capacidade 1)"; curso encerrado, so os alunos (vaga nao importa). TUR-26.
 */
function occupancyLabel(turma: Pick<ClassGroupView, "enrolledCount" | "capacity" | "isEnded">): string {
  const students = turma.enrolledCount === 1 ? "1 aluno" : `${turma.enrolledCount} alunos`;
  if (turma.isEnded) return students;
  if (turma.enrolledCount > turma.capacity) return `${students} (capacidade ${turma.capacity})`;
  return `${turma.enrolledCount} de ${turma.capacity} alunos`;
}
function ClassTags({ turma }: { turma: ClassGroupView }) {
  const mode = classBillingMode(turma);
  return (
    <>
      {mode === "course" || mode === "package" ? (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
          {mode === "course" ? "Curso" : "Pacote"}
        </span>
      ) : null}
      {turma.isEnded ? <EndedBadge /> : null}
    </>
  );
}

function TurmaRow({
  turma,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  canManage: boolean;
  onEdit: (turma: ClassGroupView) => void;
  onDeactivate: (turma: ClassGroupView) => void;
  onReactivate: (turma: ClassGroupView) => void;
}) {
  const router = useRouter();
  const isActive = turma.status === "active";
  const full = turma.availableSpots <= 0;

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          // Edita aqui mesmo (sem abrir o detalhe da turma).
          onSelect: () => onEdit(turma),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
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
            title={`Ações de ${turma.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 font-medium text-sm text-foreground break-words group-hover:text-primary transition-colors">
          {turma.name}
        </p>
        {turma.modalityName ? (
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {turma.modalityName}
          </span>
        ) : null}
        <ClassTags turma={turma} />
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
            full
              ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-border/60 bg-muted/50 text-muted-foreground",
          )}
        >
          {occupancyLabel(turma)}
        </span>
        {turma.status !== "active" ? <RecordStatusBadge status={turma.status} /> : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {turma.instructorName ? (
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3 text-muted-foreground/60" />
            <span>{turma.instructorName}</span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3 text-muted-foreground/60" />
          <span>{slotsSummary(turma.meetingSlots) || "Sem horário"}</span>
        </span>
      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function TurmaCard({
  turma,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  canManage: boolean;
  onEdit: (turma: ClassGroupView) => void;
  onDeactivate: (turma: ClassGroupView) => void;
  onReactivate: (turma: ClassGroupView) => void;
}) {
  const router = useRouter();
  const isActive = turma.status === "active";
  const full = turma.availableSpots <= 0;

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          // Edita aqui mesmo (sem abrir o detalhe da turma).
          onSelect: () => onEdit(turma),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
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

  const card = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/classes/${turma.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/classes/${turma.id}`);
        }
      }}
      className="group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all cursor-pointer hover:border-primary/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="min-w-0 break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {turma.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {turma.modalityName ? (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {turma.modalityName}
                </span>
              ) : null}
              <ClassTags turma={turma} />
              {turma.status !== "active" ? <RecordStatusBadge status={turma.status} /> : null}
            </div>
          </div>

          {canManage ? (
            <div
              className="-mr-2 -mt-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ListItemActionsMenu
                actions={actions}
                title={`Ações de ${turma.name}`}
                variant="ghost"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5 pt-1 text-xs text-muted-foreground">
          {turma.instructorName ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <User className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span className="min-w-0 break-words">{turma.instructorName}</span>
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <Clock className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 break-words">{slotsSummary(turma.meetingSlots) || "Sem horário"}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none",
            full
              ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-border/60 bg-muted/50 text-muted-foreground",
          )}
        >
          {occupancyLabel(turma)}
        </span>

        {turma.allowDropin && turma.sessionPriceCents ? (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            Avulsa: {formatCents(turma.sessionPriceCents)}
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
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      {showAction ? (
        <div className="flex size-8 shrink-0 items-center justify-center">
          <Skeleton className="h-4 w-1.5 rounded-full" />
        </div>
      ) : null}
    </div>
  ));
}

function TurmaSkeletonCards({ showAction }: { showAction: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-4 w-28 max-w-full" />
              </div>
              {showAction ? (
                <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                  <Skeleton className="h-4 w-1.5 rounded-full" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3.5 w-52 max-w-full" />
            </div>
          </div>
          <div className="mt-4 border-t border-border/50 pt-3">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_STATUS: "all" | RecordStatus = "active";

export function TurmasView({
  createCompletesSetup = false,
}: {
  /**
   * Criar uma turma agora conclui o cadastro basico: comemora em vez do aviso
   * simples. Funcao = decide pela turma criada (ex.: mensalidade numa area sem
   * mensalidade abre os passos de regras e planos, entao nao comemora).
   */
  createCompletesSetup?: boolean | ((created: ClassGroupView) => boolean);
} = {}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  // Padrao: so ativos (o dia a dia); inativos ficam a um clique no filtro.
  const [status, setStatus] = useState<"all" | RecordStatus>(DEFAULT_STATUS);
  const [viewMode, setViewMode] = useViewMode("turmas", "list");
  const { data: turmas, isLoading } = useClassGroups({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const can = useCan();
  const canManage = can("classes:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdTurmaForEnroll, setCreatedTurmaForEnroll] = useState<ClassGroupView | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [deactivatingTurma, setDeactivatingTurma] = useState<ClassGroupView | null>(null);
  const [editingTurma, setEditingTurma] = useState<ClassGroupView | null>(null);
  // Mantem a turma durante a animacao de saida (o titulo nao vira "Nova turma").
  const shownEditingTurma = useRetainedValue(editingTurma);
  // Conteudo do confirm com o ultimo valor: nao some durante a animacao de saida.
  const shownDeactivatingTurma = useRetainedValue(deactivatingTurma);

  const deactivate = useDeactivateClassGroup();
  const reactivate = useReactivateClassGroup();

  const hasSearch = Boolean(search.trim());
  // O padrao (ativos) nao conta como filtro aplicado; limpar volta para ele.
  const hasFilters = status !== DEFAULT_STATUS;

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus(DEFAULT_STATUS);
  };

  // Encerradas (fim no passado) vao para o fim da lista, sem sumir.
  const turmaList = [...(turmas ?? [])].sort((a, b) => Number(a.isEnded) - Number(b.isEnded));

  const handleDeactivate = async () => {
    if (!deactivatingTurma) return;
    try {
      await deactivate.mutateAsync(deactivatingTurma.id);
      toast.success(`Turma "${deactivatingTurma.name}" inativada.`);
      setDeactivatingTurma(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível inativar a turma."));
    }
  };

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const handleReactivate = async (turma: ClassGroupView) => {
    if (
      !(await confirmAction({
        title: "Reativar turma?",
        description: `“${turma.name}” volta a gerar aulas no calendário.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await reactivate.mutateAsync(turma.id);
      toast.success(`Turma "${turma.name}" reativada.`);
    } catch (err) {
      // Ex.: o horario da turma ficou ocupado por outra turma do instrutor.
      toast.error(getErrorMessage(err, "Não foi possível reativar a turma."));
    }
  };

  return (
    <>
      {confirmDialog}
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
          <Button
            onClick={() => setCreateOpen(true)}
            data-onboarding-cta="classes"
          >
            <Plus className="size-4" />
            Nova turma
          </Button>
        ) : null}
      </PageHeader>

      <TurmaFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          const completes =
            typeof createCompletesSetup === "function" ? createCompletesSetup(created) : createCompletesSetup;
          if (completes) {
            setCelebrate(true);
            setCreatedTurmaForEnroll(created);
          } else {
            toast.success(`Turma "${created.name}" criada com sucesso.`, {
              action: {
                label: "Matricular alunos",
                onClick: () => router.push(`/classes/${created.id}?enroll=true`),
              },
            });
          }
        }}
      />

      <TurmaFormDrawer
        open={editingTurma !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTurma(null);
        }}
        turma={shownEditingTurma ?? undefined}
      />

      <SetupCompleteDialog
        groupName={createdTurmaForEnroll?.name}
        open={createdTurmaForEnroll !== null && celebrate}
        onOpenChange={(open) => !open && setCreatedTurmaForEnroll(null)}
        onPrimary={() => {
          if (createdTurmaForEnroll) {
            router.push(`/classes/${createdTurmaForEnroll.id}?enroll=true`);
          }
          setCreatedTurmaForEnroll(null);
        }}
      />

      <ConfirmActionDialog
        open={deactivatingTurma !== null}
        onOpenChange={(open) => !open && setDeactivatingTurma(null)}
        title="Inativar turma?"
        description={
          shownDeactivatingTurma ? (
            <>
              Tem certeza que deseja inativar <strong>&ldquo;{shownDeactivatingTurma.name}&rdquo;</strong>?
              <br />
              <br />
              Os dados ficam guardados e a turma para de gerar aulas. A frequência
              e as matrículas continuam no histórico.
            </>
          ) : null
        }
        confirmLabel="Inativar"
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
          <div className="flex items-center gap-2">
            <StatusFilterSelect
              value={status}
              onChange={setStatus}
              gender="female"
            />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Contador / Resumo */}
        <ListSummaryBar
          isLoading={isLoading}
          count={turmaList.length}
          singularLabel="turma cadastrada"
          pluralLabel="turmas cadastradas"
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />

        {/* Container Unificado da Lista ou Grade de Cards */}
        {isLoading ? (
          <ViewModeSkeleton
            storageKey="turmas"
            mode={viewMode}
            list={
              <ListContainer>
                <SkeletonRows showAction={canManage} />
              </ListContainer>
            }
            grid={<TurmaSkeletonCards showAction={canManage} />}
          />
        ) : turmaList.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {turmaList.map((t) => (
              <TurmaCard
                key={t.id}
                turma={t}
                canManage={canManage}
                onEdit={setEditingTurma}
                onDeactivate={setDeactivatingTurma}
                onReactivate={handleReactivate}
              />
            ))}
          </div>
        ) : (
          <ListContainer
            emptyState={
              turmaList.length === 0 ? (
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
                    />
                  }
                />
              ) : null
            }
          >
            {turmaList.map((t) => (
              <TurmaRow
                key={t.id}
                turma={t}
                canManage={canManage}
                onEdit={setEditingTurma}
                onDeactivate={setDeactivatingTurma}
                onReactivate={handleReactivate}
              />
            ))}
          </ListContainer>
        )}
      </div>
    </>
  );
}
