"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Check, RotateCcw, Users, X } from "lucide-react";
import type { EventRosterEntry } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { todayISO } from "@gestarahub/core/date";
import { BackLink } from "@/components/shared/back-link";
import { ListItemActionsMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { useClearEventAttendance, useEventSession, useMarkEventAttendance, useMarkManyEventAttendance } from "../hooks/use-events";
import { dayLabel, sessionTimeLabel } from "../event-copy";
import { EventKindBadge } from "./event-badges";

/** Dia do evento: chamada (presente ou ausente) de quem esta inscrito nele. */
export function EventSessionView({ sessionId }: { sessionId: string }) {
  const can = useCan();
  const canMark = can("attendance:mark");
  const { data: detail, isPending, isError } = useEventSession(sessionId);
  const markMut = useMarkEventAttendance();
  const markManyMut = useMarkManyEventAttendance();
  const clearMut = useClearEventAttendance();
  const busy = markMut.isPending || markManyMut.isPending || clearMut.isPending;

  if (isError) {
    return (
      <>
        <BackLink fallbackHref="/events" />
        <p className="text-sm text-muted-foreground">Dia do evento não encontrado.</p>
      </>
    );
  }
  if (isPending || !detail) {
    return (
      <>
        <BackLink fallbackHref="/events" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <Skeleton className="mt-6 h-40 w-full rounded-lg" />
      </>
    );
  }

  const { session, event, roster } = detail;
  const today = todayISO();
  const future = session.date > today;
  const canceled = session.status === "canceled";
  const marking = canMark && !future && !canceled && event.status === "active";
  const pendingEntries = roster.filter((r) => !r.attendance);
  const presentCount = roster.filter((r) => r.attendance === "present").length;

  const fail = (error: unknown) => toast.error(getErrorMessage(error, "Não foi possível marcar a chamada."));
  const setMark = async (r: EventRosterEntry, status: "present" | "absent" | undefined) => {
    try {
      if (status) await markMut.mutateAsync({ sessionId: session.id, registrationId: r.registrationId, status });
      else await clearMut.mutateAsync({ sessionId: session.id, registrationId: r.registrationId });
    } catch (error) {
      fail(error);
    }
  };
  const allCame = async () => {
    try {
      await markManyMut.mutateAsync({ sessionId: session.id, registrationIds: pendingEntries.map((r) => r.registrationId), status: "present" });
    } catch (error) {
      fail(error);
    }
  };

  const meta = [dayLabel(session.date), sessionTimeLabel(session), `${event.instructorName}${event.isGuestInstructor ? " (convidado)" : ""}`];

  return (
    <>
      <BackLink fallbackHref={`/events/${event.id}`} />
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            <Link href={`/events/${event.id}`} className="hover:text-primary">
              {event.name}
            </Link>
          </h1>
          <EventKindBadge />
          {canceled ? (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Dia cancelado
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {meta.map((part, i) => (
            <Fragment key={`${i}-${part}`}>
              {i > 0 ? " · " : null}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
        </p>
        {future ? <p className="text-xs text-muted-foreground">A chamada abre no dia do evento.</p> : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {roster.length === 0
            ? "Ninguém inscrito neste dia."
            : future
              ? `${roster.length} ${roster.length === 1 ? "inscrito" : "inscritos"} neste dia`
              : `${presentCount} de ${roster.length} ${roster.length === 1 ? "presente" : "presentes"}`}
        </p>
        {marking && pendingEntries.length > 0 ? (
          <Button variant="outline" onClick={() => void allCame()} disabled={busy}>
            <Check className="size-4" />
            Todos vieram
          </Button>
        ) : null}
      </div>

      <ListContainer
        busy={busy}
        emptyState={
          roster.length > 0 ? undefined : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Users className="size-8 stroke-[1.5]" />
              <p className="text-sm font-medium">Ninguém inscrito neste dia.</p>
              <p className="text-xs">Inscreva alunos pelo detalhe do evento.</p>
            </div>
          )
        }
      >
        {roster.length > 0
          ? roster.map((r) => {
              const actions: ListItemAction[] = marking
                ? [
                    ...(r.attendance !== "absent"
                      ? [{ key: "absent", label: "Marcar falta", icon: <X className="size-4" />, disabled: busy, onSelect: () => void setMark(r, "absent") }]
                      : []),
                    ...(r.attendance
                      ? [{ key: "clear", label: "Desmarcar", icon: <RotateCcw className="size-4" />, disabled: busy, onSelect: () => void setMark(r, undefined) }]
                      : []),
                  ]
                : [];
              return (
                <ListRow
                  key={r.registrationId}
                  onClick={marking ? () => void setMark(r, r.attendance === "present" ? undefined : "present") : undefined}
                  canClick={marking}
                  aria-label={`${r.studentName}: ${r.attendance === "present" ? "presente" : r.attendance === "absent" ? "faltou" : "sem marcação"}`}
                  actions={
                    r.attendance === "absent" || actions.length > 0 ? (
                      <>
                        {r.attendance === "absent" ? <span className="text-xs font-medium text-red-600 dark:text-red-400">Faltou</span> : null}
                        {actions.length > 0 ? <ListItemActionsMenu title="Mais opções" ariaLabel={`Ações de ${r.studentName}`} variant="ghost" actions={actions} /> : null}
                      </>
                    ) : undefined
                  }
                >
                  <div className="flex items-center gap-3">
                    {future ? null : (
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          r.attendance === "present" ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500" : "border-border text-transparent",
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <p className="min-w-0 break-words text-sm font-medium text-foreground">{r.studentName}</p>
                      {r.scope === "days" ? <p className="text-xs text-muted-foreground">Só alguns dias</p> : null}
                    </div>
                  </div>
                </ListRow>
              );
            })
          : null}
      </ListContainer>
    </>
  );
}
