"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ListItemCard } from "@/components/shared/list-item-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassSessions } from "../hooks/use-turmas";

const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const WEEKDAY_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function TurmasCalendarView() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  // So renderiza no client (evita mismatch de hidratacao com a data do server).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const { data: sessions, isLoading } = useClassSessions({
    dateFrom: toISO(weekStart),
    dateTo: toISO(weekEnd),
  });

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <>
      <PageHeader
        title="Calendário de turmas"
        description="Aulas da semana, agrupadas por dia."
      >
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Semana anterior"
            onClick={() => setAnchor(addWeeks(anchor, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próxima semana"
            onClick={() => setAnchor(addWeeks(anchor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </PageHeader>

      {!mounted || isLoading ? (
        <Skeleton className="h-64 w-full rounded-md" />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {format(weekStart, "dd/MM")} – {format(weekEnd, "dd/MM/yyyy")}
          </p>
          <div className="space-y-4">
            {days.map((d) => {
              const iso = toISO(d);
              const daySessions = (sessions ?? []).filter((s) => s.date === iso);
              return (
                <div key={iso}>
                  <p className="mb-1.5 text-sm font-semibold">
                    {WEEKDAY_LONG[d.getDay()]}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {format(d, "dd/MM")}
                    </span>
                  </p>
                  {daySessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem aulas.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {daySessions.map((s) => (
                        <Link
                          key={s.id}
                          href={`/classes/sessions/${encodeURIComponent(s.id)}`}
                          className="block"
                        >
                          <ListItemCard>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {s.className}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {s.modalityName ? `${s.modalityName} · ` : ""}
                                  {s.instructorName}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                {s.start}–{s.end}
                              </span>
                            </div>
                          </ListItemCard>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
