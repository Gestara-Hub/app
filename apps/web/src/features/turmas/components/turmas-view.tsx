"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog, useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import {
  Calendar,
  CalendarRange,
  Clock,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Power,
  PowerOff,
  User,
  UserPlus,
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
import type {
  ClassBillingMode,
  ClassGroupView,
  ClassMeetingSlot,
  DateISO,
  RecordStatus,
  Weekday,
} from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useTeamWords } from "@/features/settings";
import {
  useClassGroups,
  useDeactivateClassGroup,
  useReactivateClassGroup,
} from "../hooks/use-turmas";
import {
  NEUTRAL_MODALITY_COLOR,
  modalityColorMap,
  type ModalityColor,
} from "../modality-colors";
import { TurmaFormDrawer } from "./turma-form-drawer";
import { SetupCompleteDialog } from "./setup-complete-dialog";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const BILLING_LABELS: Record<ClassBillingMode, string> = {
  membership: "Mensalidade",
  course: "Curso",
  package: "Pacote",
  free: "Gratuita",
};

const ALL = "all";

function weekdaySortKey(day: Weekday): number {
  return day === 0 ? 7 : day;
}

function formatDayRuns(days: Weekday[]): string {
  const uniqueSorted = [...new Set(days)].sort(
    (a, b) => weekdaySortKey(a) - weekdaySortKey(b),
  );
  if (uniqueSorted.length === 0) return "";

  const runs: Weekday[][] = [];
  for (const day of uniqueSorted) {
    const lastRun = runs[runs.length - 1];
    if (
      lastRun &&
      weekdaySortKey(day) === weekdaySortKey(lastRun[lastRun.length - 1]) + 1
    ) {
      lastRun.push(day);
    } else {
      runs.push([day]);
    }
  }

  return runs
    .map((run) => {
      if (run.length >= 3) {
        return `${WEEKDAY_SHORT[run[0]]} a ${WEEKDAY_SHORT[run[run.length - 1]]}`;
      }
      return run.map((d) => WEEKDAY_SHORT[d]).join(", ");
    })
    .join(", ");
}

/**
 * Resume os horarios agrupando dias que compartilham o mesmo horario de inicio
 * (ex.: Seg a Sex · 09:00, ou Seg, Qua, Sex · 08:00).
 */
export function slotsSummary(slots?: ClassMeetingSlot[]): string {
  const list = slots ?? [];
  if (list.length === 0) return "";
  const byStart = new Map<string, Weekday[]>();
  for (const slot of list) {
    const days = byStart.get(slot.start) ?? [];
    days.push(slot.weekday);
    byStart.set(slot.start, days);
  }
  return [...byStart.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, days]) => `${formatDayRuns(days)} · ${start}`)
    .join(" · ");
}

function formatShortDate(iso?: DateISO): string | undefined {
  if (!iso || iso.length < 10) return undefined;
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function formatShortDateRange(start?: DateISO, end?: DateISO): string | undefined {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `A partir de ${s}`;
  if (e) return `Até ${e}`;
  return undefined;
}

/** Selo de turma ou curso que ja terminou (data de fim no passado). */
export function EndedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
      Encerrado
    </span>
  );
}

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

function occupancyTone(turma: Pick<ClassGroupView, "enrolledCount" | "capacity" | "isEnded">): {
  barClass: string;
  textClass: string;
  ratio: number;
  hint?: string;
} {
  if (turma.isEnded || turma.capacity <= 0) {
    return { barClass: "bg-muted-foreground/40", textClass: "text-muted-foreground", ratio: 0 };
  }
  const ratio = Math.min(100, Math.round((turma.enrolledCount / turma.capacity) * 100));
  const remaining = turma.capacity - turma.enrolledCount;
  if (remaining <= 0) {
    return {
      barClass: "bg-amber-500",
      textClass: "text-amber-700 dark:text-amber-400 font-medium",
      ratio: 100,
      hint: turma.enrolledCount > turma.capacity ? undefined : "Turma lotada",
    };
  }
  if (ratio >= 80 || remaining <= 2) {
    return {
      barClass: "bg-amber-500",
      textClass: "text-amber-700 dark:text-amber-400 font-medium",
      ratio,
      hint: `${remaining} ${remaining === 1 ? "vaga" : "vagas"}`,
    };
  }
  return {
    barClass: "bg-primary",
    textClass: "text-muted-foreground",
    ratio,
  };
}

/** Selos de modalidade (com cor do calendario), cobranca ("Curso", "Pacote") e fim. */
function ClassTags({
  turma,
  color,
}: {
  turma: ClassGroupView;
  color: ModalityColor;
}) {
  const mode = classBillingMode(turma);
  return (
    <>
      {turma.modalityName ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn("size-2 shrink-0 rounded-full", color.dot)} aria-hidden />
          {turma.modalityName}
        </span>
      ) : null}
      {mode === "course" || mode === "package" ? (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
          {mode === "course" ? "Curso" : "Pacote"}
        </span>
      ) : null}
      {turma.isEnded ? <EndedBadge /> : null}
    </>
  );
}

function OccupancyBlock({
  turma,
  align = "right",
}: {
  turma: ClassGroupView;
  align?: "left" | "right";
}) {
  const tone = occupancyTone(turma);
  const label = occupancyLabel(turma);

  if (turma.isEnded) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        align === "left" && "flex-row-reverse justify-end",
      )}
    >
      <div className={cn(align === "right" ? "text-right" : "text-left")}>
        <p className={cn("text-xs tabular-nums leading-tight", tone.textClass)}>
          {label}
        </p>
        {tone.hint ? (
          <p className={cn("text-[11px] leading-tight", tone.textClass)}>
            {tone.hint}
          </p>
        ) : null}
      </div>
      <div
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:w-16"
      >
        <div
          className={cn("h-full rounded-full transition-all", tone.barClass)}
          style={{ width: `${tone.ratio}%` }}
        />
      </div>
    </div>
  );
}

function buildTurmaActions({
  turma,
  canManage,
  onOpen,
  onEnroll,
  onCalendar,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  canManage: boolean;
  onOpen: () => void;
  onEnroll: () => void;
  onCalendar: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}): ListItemAction[] {
  const isActive = turma.status === "active";
  const actions: ListItemAction[] = [
    {
      key: "open",
      label: "Abrir turma",
      icon: <ExternalLink className="size-4" />,
      onSelect: onOpen,
    },
  ];

  if (canManage && isActive && !turma.isEnded) {
    actions.push({
      key: "enroll",
      label: "Matricular alunos",
      icon: <UserPlus className="size-4" />,
      onSelect: onEnroll,
    });
  }

  actions.push({
    key: "calendar",
    label: "Ver no calendário",
    icon: <CalendarRange className="size-4" />,
    onSelect: onCalendar,
  });

  if (canManage) {
    actions.push(
      {
        key: "edit",
        label: "Editar",
        icon: <Pencil className="size-4" />,
        // Edita aqui mesmo (sem abrir o detalhe da turma).
        onSelect: onEdit,
      },
      isActive
        ? {
            key: "inactivate",
            label: "Inativar",
            icon: <PowerOff className="size-4" />,
            onSelect: onDeactivate,
            destructive: true,
          }
        : {
            key: "reactivate",
            label: "Reativar",
            icon: <Power className="size-4" />,
            onSelect: onReactivate,
          },
    );
  }

  return actions;
}

function TurmaRow({
  turma,
  color,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  color: ModalityColor;
  canManage: boolean;
  onEdit: (turma: ClassGroupView) => void;
  onDeactivate: (turma: ClassGroupView) => void;
  onReactivate: (turma: ClassGroupView) => void;
}) {
  const router = useRouter();
  const mode = classBillingMode(turma);
  const schedule = slotsSummary(turma.meetingSlots) || "Sem horário";
  const courseRange = mode === "course" ? formatShortDateRange(turma.startDate, turma.endDate) : undefined;
  const planText = mode === "membership" && turma.planName ? `Plano: ${turma.planName}` : undefined;
  const dropinText =
    turma.allowDropin && turma.sessionPriceCents
      ? `Avulsa: ${formatCents(turma.sessionPriceCents)}`
      : undefined;

  const actions = buildTurmaActions({
    turma,
    canManage,
    onOpen: () => router.push(`/classes/${turma.id}`),
    onEnroll: () => router.push(`/classes/${turma.id}?enroll=true`),
    onCalendar: () => router.push(`/classes/calendar?classGroupId=${turma.id}`),
    onEdit: () => onEdit(turma),
    onDeactivate: () => onDeactivate(turma),
    onReactivate: () => onReactivate(turma),
  });

  return (
    <ListItemContextMenu actions={actions}>
      <ListRow
        data-record-id={turma.id}
        onClick={() => router.push(`/classes/${turma.id}`)}
        canClick
        actions={
          <ListItemActionsMenu
            actions={actions}
            title={`Ações de ${turma.name}`}
            variant="ghost"
          />
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 font-medium text-sm text-foreground break-words group-hover:text-primary transition-colors">
                {turma.name}
              </p>
              <ClassTags turma={turma} color={color} />
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
                <span>{schedule}</span>
              </span>
              {courseRange ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3 text-muted-foreground/60" />
                  <span>{courseRange}</span>
                </span>
              ) : null}
              {planText ? <span>{planText}</span> : null}
              {dropinText ? <span className="tabular-nums">{dropinText}</span> : null}
            </div>
          </div>

          <div className="hidden shrink-0 sm:block">
            <OccupancyBlock turma={turma} align="right" />
          </div>
        </div>

        <div className="mt-1.5 sm:hidden">
          <span className={cn("text-xs tabular-nums", occupancyTone(turma).textClass)}>
            {occupancyLabel(turma)}
          </span>
        </div>
      </ListRow>
    </ListItemContextMenu>
  );
}

function TurmaCard({
  turma,
  color,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  turma: ClassGroupView;
  color: ModalityColor;
  canManage: boolean;
  onEdit: (turma: ClassGroupView) => void;
  onDeactivate: (turma: ClassGroupView) => void;
  onReactivate: (turma: ClassGroupView) => void;
}) {
  const router = useRouter();
  const mode = classBillingMode(turma);
  const schedule = slotsSummary(turma.meetingSlots) || "Sem horário";
  const courseRange = mode === "course" ? formatShortDateRange(turma.startDate, turma.endDate) : undefined;
  const planText = mode === "membership" && turma.planName ? `Plano: ${turma.planName}` : undefined;
  const dropinText =
    turma.allowDropin && turma.sessionPriceCents
      ? `Avulsa: ${formatCents(turma.sessionPriceCents)}`
      : undefined;

  const actions = buildTurmaActions({
    turma,
    canManage,
    onOpen: () => router.push(`/classes/${turma.id}`),
    onEnroll: () => router.push(`/classes/${turma.id}?enroll=true`),
    onCalendar: () => router.push(`/classes/calendar?classGroupId=${turma.id}`),
    onEdit: () => onEdit(turma),
    onDeactivate: () => onDeactivate(turma),
    onReactivate: () => onReactivate(turma),
  });

  return (
    <ListItemContextMenu actions={actions}>
      <div
        data-record-id={turma.id}
        onClick={() => router.push(`/classes/${turma.id}`)}
        className={cn(
          "group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 shadow-2xs transition-all cursor-pointer hover:border-primary/40 hover:shadow-xs",
          turma.modalityName && "pl-5",
        )}
      >
        {turma.modalityName ? (
          <span
            aria-hidden
            className={cn("absolute inset-y-0 left-0 w-1", color.dot)}
          />
        ) : null}

        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/classes/${turma.id}`);
                }
              }}
              className="min-w-0 flex-1 space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="min-w-0 break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {turma.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <ClassTags turma={turma} color={color} />
                {turma.status !== "active" ? <RecordStatusBadge status={turma.status} /> : null}
              </div>
            </div>

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
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-muted-foreground">
            {turma.instructorName ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <User className="size-3.5 shrink-0 text-muted-foreground/60" />
                <span className="min-w-0 truncate">{turma.instructorName}</span>
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span className="min-w-0 truncate">{schedule}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <OccupancyBlock turma={turma} align="left" />

          {dropinText || courseRange || planText ? (
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
              {courseRange ? (
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                  <Calendar className="size-3 text-muted-foreground/60" />
                  <span>{courseRange}</span>
                </span>
              ) : null}
              {dropinText ? (
                <span className="shrink-0 tabular-nums">{dropinText}</span>
              ) : planText && !courseRange ? (
                <span className="truncate">{planText}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </ListItemContextMenu>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center">
        <Skeleton className="h-4 w-1.5 rounded-full" />
      </div>
    </div>
  ));
}

function TurmaSkeletonCards() {
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
              <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                <Skeleton className="h-4 w-1.5 rounded-full" />
              </div>
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
  const team = useTeamWords();
  const [search, setSearch] = useState("");
  // Padrao: so ativos (o dia a dia); inativos ficam a um clique no filtro.
  const [status, setStatus] = useState<"all" | RecordStatus>(DEFAULT_STATUS);
  const [modalityFilter, setModalityFilter] = useState<string>(ALL);
  const [billingFilter, setBillingFilter] = useState<string>(ALL);
  const [instructorFilter, setInstructorFilter] = useState<string>(ALL);

  const [viewMode, setViewMode] = useViewMode("turmas", "list");
  const { data: categories } = useCategories();
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

  const colorMap = useMemo(
    () => modalityColorMap(categories ?? []),
    [categories],
  );

  const filterChoices = useMemo(() => {
    const modalities = new Set<string>();
    const instructors = new Set<string>();
    const modes = new Set<ClassBillingMode>();

    for (const c of turmas ?? []) {
      if (c.modalityName) modalities.add(c.modalityName);
      if (c.instructorName) instructors.add(c.instructorName);
      modes.add(classBillingMode(c));
    }

    return {
      modalities: [...modalities].sort((a, b) => a.localeCompare(b, "pt-BR")),
      instructors: [...instructors].sort((a, b) => a.localeCompare(b, "pt-BR")),
      modes: [...modes],
    };
  }, [turmas]);

  const hasSearch = Boolean(search.trim());
  const hasExtraFilters =
    modalityFilter !== ALL || billingFilter !== ALL || instructorFilter !== ALL;
  // O padrao (ativos) nao conta como filtro aplicado; limpar volta para ele.
  const hasFilters = status !== DEFAULT_STATUS || hasExtraFilters;

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus(DEFAULT_STATUS);
    setModalityFilter(ALL);
    setBillingFilter(ALL);
    setInstructorFilter(ALL);
  };

  // Encerradas (fim no passado) vao para o fim da lista, sem sumir.
  const turmaList = useMemo(() => {
    return [...(turmas ?? [])]
      .filter((c) => {
        if (modalityFilter !== ALL && c.modalityName !== modalityFilter) return false;
        if (billingFilter !== ALL && classBillingMode(c) !== billingFilter) return false;
        if (instructorFilter !== ALL && c.instructorName !== instructorFilter) return false;
        return true;
      })
      .sort((a, b) => Number(a.isEnded) - Number(b.isEnded));
  }, [turmas, modalityFilter, billingFilter, instructorFilter]);

  const showExtraFilterBar = (turmas?.length ?? 0) > 0 || hasExtraFilters;

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
        <div className="space-y-2.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              placeholder="Buscar turma..."
              value={search}
              onChange={setSearch}
              onClear={clearSearch}
              aria-label="Buscar turma"
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusFilterSelect
                value={status}
                onChange={setStatus}
                gender="female"
              />
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {showExtraFilterBar ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-44" aria-label="Filtrar por modalidade">
                  <SelectValue placeholder="Todas modalidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas modalidades</SelectItem>
                  {filterChoices.modalities.map((name) => {
                    const dot = colorMap.get(name)?.dot ?? NEUTRAL_MODALITY_COLOR.dot;
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full", dot)} aria-hidden />
                          {name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={billingFilter} onValueChange={setBillingFilter}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-40" aria-label="Filtrar por cobrança">
                  <SelectValue placeholder="Todas cobranças" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas cobranças</SelectItem>
                  {filterChoices.modes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {BILLING_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-44" aria-label={`Filtrar por ${team.lower}`}>
                  <SelectValue placeholder={`Todos ${team.lowerPlural}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{`Todos ${team.lowerPlural}`}</SelectItem>
                  {filterChoices.instructors.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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
                <SkeletonRows />
              </ListContainer>
            }
            grid={<TurmaSkeletonCards />}
          />
        ) : turmaList.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {turmaList.map((t) => (
              <TurmaCard
                key={t.id}
                turma={t}
                color={
                  (t.modalityName && colorMap.get(t.modalityName)) ||
                  NEUTRAL_MODALITY_COLOR
                }
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
                color={
                  (t.modalityName && colorMap.get(t.modalityName)) ||
                  NEUTRAL_MODALITY_COLOR
                }
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
