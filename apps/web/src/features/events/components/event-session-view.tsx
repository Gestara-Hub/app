"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Check, CloudDownload, QrCode, RotateCcw, Users, WifiOff, X } from "lucide-react";
import type { CheckInList, EventRosterEntry } from "@gestarahub/contracts";
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
import { useAudioFeedback } from "@/features/preferences";
import { useClearEventAttendance, useEventSession, useMarkEventAttendance, useMarkManyEventAttendance } from "../hooks/use-events";
import { dayLabel, instructorsLabel, sessionInstructors, sessionTimeLabel } from "../event-copy";
import { EventKindBadge } from "./event-badges";
import { TicketScanner } from "./ticket-scanner";
import { eventsService } from "@/services/events";
import { clearCheckInLists, enableOfflineCheckIn, loadCheckInList, saveCheckInList } from "../offline-check-in";

/** Dia do evento: chamada (presente ou ausente) de quem esta inscrito nele. */
export function EventSessionView({ sessionId }: { sessionId: string }) {
  const can = useCan();
  const canMark = can("attendance:mark");
  const [scanning, setScanning] = useState(false);
  const { data: detail, isPending, isError } = useEventSession(sessionId);
  const markMut = useMarkEventAttendance();
  const markManyMut = useMarkManyEventAttendance();
  const clearMut = useClearEventAttendance();
  // Mesmo som da chamada das turmas (Preferências → Sons), na hora do toque.
  const { playChime } = useAudioFeedback();
  const busy = markMut.isPending || markManyMut.isPending || clearMut.isPending;
  // Lista do dia guardada no aparelho (leitura sem internet, doc product/29).
  const [storedList, setStoredList] = useState<CheckInList | undefined>();
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    void loadCheckInList(sessionId).then(setStoredList);
  }, [sessionId]);
  const listTime = storedList ? new Date(storedList.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  const prepareOffline = async () => {
    setPreparing(true);
    try {
      const list = await eventsService.getCheckInList(sessionId);
      await clearCheckInLists(list.date);
      await saveCheckInList(list);
      await enableOfflineCheckIn();
      setStoredList(list);
      toast.success(`Lista pronta: ${list.entries.length} ${list.entries.length === 1 ? "inscrito" : "inscritos"}. Deixe esta tela aberta.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível baixar a lista."));
    } finally {
      setPreparing(false);
    }
  };

  // Sem internet, com a lista guardada: so a leitura dos ingressos.
  if (isError && storedList) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">{storedList.eventName}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <WifiOff className="size-4" aria-hidden />
          Sem internet · usando a lista das {listTime}
        </p>
        <Button className="mt-4" onClick={() => setScanning(true)}>
          <QrCode className="size-4" />
          Ler ingressos
        </Button>
        {scanning ? <TicketScanner sessionId={sessionId} eventName={storedList.eventName} onClose={() => setScanning(false)} /> : null}
      </>
    );
  }

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
    if (status === "present") playChime("checkin");
    try {
      if (status) await markMut.mutateAsync({ sessionId: session.id, registrationId: r.registrationId, status });
      else await clearMut.mutateAsync({ sessionId: session.id, registrationId: r.registrationId });
    } catch (error) {
      fail(error);
    }
  };
  const allCame = async () => {
    if (pendingEntries.length > 0) playChime("checkin");
    try {
      await markManyMut.mutateAsync({ sessionId: session.id, registrationIds: pendingEntries.map((r) => r.registrationId), status: "present" });
    } catch (error) {
      fail(error);
    }
  };

  const meta = [dayLabel(session.date), sessionTimeLabel(session), instructorsLabel(sessionInstructors(event, session))].filter(Boolean);

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Entrada pelo ingresso (doc product/29 T6): so no dia, com inscritos. */}
          {marking && session.date === today && roster.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => void prepareOffline()} disabled={preparing}>
                <CloudDownload className="size-4" />
                {preparing ? "Baixando..." : storedList ? "Atualizar lista" : "Preparar para usar sem internet"}
              </Button>
              <Button onClick={() => setScanning(true)}>
                <QrCode className="size-4" />
                Ler ingressos
              </Button>
            </>
          ) : null}
          {marking && pendingEntries.length > 0 ? (
            <Button variant="outline" onClick={() => void allCame()} disabled={busy}>
              <Check className="size-4" />
              Todos vieram
            </Button>
          ) : null}
        </div>
      </div>
      {storedList && session.date === today ? (
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">Pronto para usar sem internet · lista das {listTime}</p>
      ) : null}
      {scanning ? <TicketScanner sessionId={session.id} eventName={event.name} onClose={() => setScanning(false)} /> : null}

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
