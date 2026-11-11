"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CalendarRange, Clock, Pencil, Plus, Ticket, User, XCircle } from "lucide-react";
import type { EventStage, EventView } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { ListItemActionsMenu, ListItemContextMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
  ViewModeSkeleton,
  ViewModeToggle,
  useViewMode,
} from "@/components/shared/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCan } from "@/features/auth";
import { useCancelEvent, useEvents } from "../hooks/use-events";
import { billingSummary, datesLabel, hoursLabel, instructorsShortLabel, occupancyLabel, STAGE_LABEL } from "../event-copy";
import { EventFormDrawer } from "./event-form-drawer";
import { EventStatusBadge } from "./event-badges";

type StageFilter = "all" | EventStage | "canceled";

const STAGE_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "Todos os eventos" },
  { value: "upcoming", label: STAGE_LABEL.upcoming },
  { value: "ongoing", label: STAGE_LABEL.ongoing },
  { value: "finished", label: STAGE_LABEL.finished },
  { value: "canceled", label: "Cancelados" },
];

function eventActions(
  event: EventView,
  canManage: boolean,
  onEdit: (event: EventView) => void,
  onCancel: (event: EventView) => void,
): ListItemAction[] {
  const editable = canManage && event.status === "active";
  const cancelable = editable && event.stage !== "finished";
  return [
    ...(editable ? [{ key: "edit", label: "Editar", icon: <Pencil className="size-4" />, onSelect: () => onEdit(event) }] : []),
    ...(cancelable
      ? [{ key: "cancel", label: "Cancelar evento", icon: <XCircle className="size-4" />, destructive: true, onSelect: () => onCancel(event) }]
      : []),
  ];
}

const MODALITY_CHIP = "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground";
const OCCUPANCY_CHIP =
  "inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground";

function instructorLabel(event: EventView): string {
  return instructorsShortLabel(event.instructors);
}

function EventRow({
  event,
  canManage,
  onEdit,
  onCancel,
}: {
  event: EventView;
  canManage: boolean;
  onEdit: (event: EventView) => void;
  onCancel: (event: EventView) => void;
}) {
  const router = useRouter();
  const actions = eventActions(event, canManage, onEdit, onCancel);
  const row = (
    <ListRow
      onClick={() => router.push(`/events/${event.id}`)}
      canClick
      actions={actions.length > 0 ? <ListItemActionsMenu actions={actions} title={`Ações de ${event.name}`} variant="ghost" /> : null}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 break-words text-sm font-medium text-foreground transition-colors group-hover:text-primary">{event.name}</p>
        {event.modalityName ? <span className={MODALITY_CHIP}>{event.modalityName}</span> : null}
        <EventStatusBadge event={event} />
        <span className={OCCUPANCY_CHIP}>{occupancyLabel(event)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3 text-muted-foreground/60" />
          <span>{datesLabel(event)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3 text-muted-foreground/60" />
          <span>{hoursLabel(event.totalHours)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3 text-muted-foreground/60" />
          <span className="min-w-0 break-words">{instructorLabel(event)}</span>
        </span>
        <span className="tabular-nums">{billingSummary(event)}</span>
      </div>
    </ListRow>
  );
  if (actions.length === 0) return row;
  return <ListItemContextMenu actions={actions}>{row}</ListItemContextMenu>;
}

/** Cartao no modo "Cartões", no mesmo desenho do cartao de turma. */
function EventCard({
  event,
  canManage,
  onEdit,
  onCancel,
}: {
  event: EventView;
  canManage: boolean;
  onEdit: (event: EventView) => void;
  onCancel: (event: EventView) => void;
}) {
  const router = useRouter();
  const actions = eventActions(event, canManage, onEdit, onCancel);
  const open = () => router.push(`/events/${event.id}`);
  const card = (
    <div
      onClick={open}
      className="group flex h-full cursor-pointer flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            }}
            className="min-w-0 flex-1 space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="min-w-0 break-words text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
              {event.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {event.modalityName ? <span className={MODALITY_CHIP}>{event.modalityName}</span> : null}
              <EventStatusBadge event={event} />
            </div>
          </div>
          {actions.length > 0 ? (
            <div className="-mr-2 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <ListItemActionsMenu actions={actions} title={`Ações de ${event.name}`} variant="ghost" />
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5 pt-1 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 break-words">
              {datesLabel(event)} · {hoursLabel(event.totalHours)}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <User className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 break-words">{instructorLabel(event)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        <span className={OCCUPANCY_CHIP}>{occupancyLabel(event)}</span>
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{billingSummary(event)}</span>
      </div>
    </div>
  );
  if (actions.length === 0) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
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

function SkeletonCards({ showAction }: { showAction: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
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

export function EventsView() {
  const can = useCan();
  const canManage = can("events:manage");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const filter = {
    ...(search ? { search } : {}),
    ...(stage === "canceled" ? { status: "canceled" as const } : stage !== "all" ? { stage, status: "active" as const } : {}),
  };
  const { data, isPending } = useEvents(filter);
  const events = useRetainedValue(data) ?? [];
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventView | undefined>();
  const cancelMut = useCancelEvent();
  const { confirm, dialog } = useConfirmAction();
  const hasFilters = Boolean(search) || stage !== "all";
  const [viewMode, setViewMode] = useViewMode("events", "list");

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (event: EventView) => {
    setEditing(event);
    setFormOpen(true);
  };
  const cancelEvent = async (event: EventView) => {
    const ok = await confirm({
      title: `Cancelar ${event.name}?`,
      description:
        event.confirmedCount > 0
          ? `As ${event.confirmedCount === 1 ? "inscrição" : `${event.confirmedCount} inscrições`} e as parcelas que ainda vão vencer são canceladas. O que já foi pago fica.`
          : "Os dias do evento saem do calendário.",
      confirmLabel: "Cancelar evento",
      cancelLabel: "Voltar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelMut.mutateAsync({ id: event.id });
      toast.success("Evento cancelado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar o evento."));
    }
  };

  const showEmptyGuide = !isPending && events.length === 0 && !hasFilters;

  return (
    <>
      {dialog}
      <PageHeader title="Eventos" description="Seminários, workshops e aulões com datas fechadas.">
        {/* Mesmo calendario das turmas, ja filtrado em "Só eventos" (doc product/29). */}
        {can("classes:view") ? (
          <Button asChild variant="outline">
            <Link href="/classes/calendar?show=events">
              <CalendarRange className="size-4" />
              Calendário
            </Link>
          </Button>
        ) : null}
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo evento
          </Button>
        ) : null}
      </PageHeader>

      <EventFormDrawer open={formOpen} onOpenChange={setFormOpen} event={editing} />

      {showEmptyGuide ? (
        <ModuleEmptyGuide
          icon={<Ticket className="size-8 stroke-[1.5]" />}
          title="Nenhum evento ainda"
          description="Cadastre um seminário ou workshop com as datas, quem conduz e como é cobrado."
          actionLabel={canManage ? "Novo evento" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder="Buscar evento ou convidado..."
              aria-label="Buscar evento ou convidado"
            />
            <div className="flex items-center gap-2">
              <Select value={stage} onValueChange={(v) => setStage(v as StageFilter)}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Situação">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
          <ListSummaryBar
            count={events.length}
            singularLabel="evento cadastrado"
            pluralLabel="eventos cadastrados"
            isLoading={isPending}
            hasFilters={hasFilters}
            onClearFilters={() => {
              setSearch("");
              setStage("all");
            }}
          />
          {isPending && events.length === 0 ? (
            <ViewModeSkeleton
              storageKey="events"
              mode={viewMode}
              list={
                <ListContainer>
                  <SkeletonRows showAction={canManage} />
                </ListContainer>
              }
              grid={<SkeletonCards showAction={canManage} />}
            />
          ) : events.length > 0 && viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} canManage={canManage} onEdit={openEdit} onCancel={(e) => void cancelEvent(e)} />
              ))}
            </div>
          ) : (
            <ListContainer
              emptyState={
                events.length > 0 ? undefined : (
                  <ListEmptyState
                    hasSearch={Boolean(search)}
                    hasFilters={stage !== "all"}
                    onClearSearch={() => setSearch("")}
                    onClearFilters={() => setStage("all")}
                    emptyGuide={null}
                  />
                )
              }
            >
              {events.map((event) => (
                <EventRow key={event.id} event={event} canManage={canManage} onEdit={openEdit} onCancel={(e) => void cancelEvent(e)} />
              ))}
            </ListContainer>
          )}
        </div>
      )}
    </>
  );
}
