"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ListItemCard } from "@/components/shared/list-item-card";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { todayISO } from "@gestarahub/core/date";
import { useClassGroups, useClassSessions } from "../hooks/use-turmas";
import { TurmasWeekGrid, dayLabel } from "./turmas-week-grid";

type View = "grid" | "list";

const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const ALL = "all";

export function TurmasCalendarView() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [view, setView] = useState<View>("grid");
  const [modality, setModality] = useState<string>(ALL);
  const [instructor, setInstructor] = useState<string>(ALL);

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
  const { data: turmas } = useClassGroups();

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = todayISO();

  const occupancyByClass = useMemo(
    () =>
      new Map(
        (turmas ?? []).map((t) => [
          t.id,
          { enrolled: t.enrolledCount, capacity: t.capacity },
        ]),
      ),
    [turmas],
  );

  const modalityOptions = useMemo(() => {
    const names = new Set(
      (sessions ?? []).map((s) => s.modalityName).filter(Boolean) as string[],
    );
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sessions]);

  const instructorOptions = useMemo(() => {
    const names = new Set((sessions ?? []).map((s) => s.instructorName));
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sessions]);

  const filtered = useMemo(
    () =>
      (sessions ?? []).filter(
        (s) =>
          (modality === ALL || s.modalityName === modality) &&
          (instructor === ALL || s.instructorName === instructor),
      ),
    [sessions, modality, instructor],
  );

  const hasFilters = modality !== ALL || instructor !== ALL;

  return (
    <>
      <PageHeader
        title="Calendário de turmas"
        description="Grade semanal das aulas."
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Visão do calendário"
            className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
          >
            {(
              [
                ["grid", "Grade", LayoutGrid],
                ["list", "Lista", List],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {format(weekStart, "dd/MM")} – {format(weekEnd, "dd/MM/yyyy")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger className="w-44" aria-label="Filtrar por modalidade">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as modalidades</SelectItem>
              {modalityOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={instructor} onValueChange={setInstructor}>
            <SelectTrigger className="w-44" aria-label="Filtrar por instrutor">
              <SelectValue placeholder="Instrutor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os instrutores</SelectItem>
              {instructorOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!mounted || isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border">
          <ModuleEmptyGuide
            icon={<CalendarRange className="size-8" />}
            title={
              hasFilters
                ? "Nenhuma aula para os filtros aplicados."
                : "Nenhuma aula nesta semana."
            }
            description={
              hasFilters
                ? "Ajuste modalidade ou instrutor para ver a grade."
                : "As aulas aparecem aqui a partir dos horários das turmas ativas."
            }
            actionLabel={hasFilters ? "Limpar filtros" : undefined}
            onAction={
              hasFilters
                ? () => {
                    setModality(ALL);
                    setInstructor(ALL);
                  }
                : undefined
            }
          />
        </div>
      ) : view === "grid" ? (
        <TurmasWeekGrid days={days} sessions={filtered} />
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const iso = toISO(d);
            const daySessions = filtered.filter((s) => s.date === iso);
            if (daySessions.length === 0) return null;
            const isToday = iso === today;
            return (
              <div key={iso}>
                {/* O tema e neutro: `text-primary` fica igual ao foreground e
                    nao destacaria nada — quem marca o dia e o badge. */}
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span>
                    {dayLabel(d)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {format(d, "dd/MM")}
                    </span>
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Hoje
                    </span>
                  ) : null}
                </p>
                <div className="space-y-1.5">
                  {daySessions.map((s) => {
                    const occ = occupancyByClass.get(s.classGroupId);
                    return (
                      <Link
                        key={s.id}
                        href={`/classes/sessions/${encodeURIComponent(s.id)}`}
                        className="block"
                      >
                        <ListItemCard>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{s.className}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {s.modalityName ? `${s.modalityName} · ` : ""}
                                {s.instructorName}
                                {occ
                                  ? ` · ${occ.enrolled}/${occ.capacity} vagas`
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                              {s.start}–{s.end}
                            </span>
                          </div>
                        </ListItemCard>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
