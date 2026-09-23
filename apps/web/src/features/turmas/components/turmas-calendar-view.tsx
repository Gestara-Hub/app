"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isValid,
  parseISO,
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
import { useClassSessions } from "../hooks/use-turmas";
import { rememberCalendarQuery } from "../calendar-filters";
import { TurmasWeekGrid, dayLabel } from "./turmas-week-grid";

type View = "grid" | "list";

const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const ALL = "all";

// Tela pequena (abaixo do breakpoint sm do Tailwind): a grade pede rolagem lateral.
const MOBILE_QUERY = "(max-width: 639px)";
function subscribeMobile(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** `false` no server e na hidratacao; depois reflete a largura real. */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/**
 * Filtros na URL (?week=&view=&modality=&instructor=): sobrevivem ao reload e ao
 * voltar de uma aula. Valores padrao (semana atual, todos) ficam de fora; a visao
 * escolhida vai sempre na URL, e sem escolha o padrao e grade (lista no celular).
 */
function useCalendarFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  useEffect(() => {
    rememberCalendarQuery(queryString);
  }, [queryString]);

  const weekParam = searchParams.get("week");
  const parsedWeek = weekParam ? parseISO(weekParam) : null;
  const anchor = parsedWeek && isValid(parsedWeek) ? parsedWeek : new Date();
  const isMobile = useIsMobile();
  const viewParam = searchParams.get("view");
  const view: View =
    viewParam === "list" || viewParam === "grid" ? viewParam : isMobile ? "list" : "grid";
  const modality = searchParams.get("modality") ?? ALL;
  const instructor = searchParams.get("instructor") ?? ALL;

  const update = (patch: Record<string, string | null>) => {
    // Parte da URL atual (nao do snapshot do render): duas trocas seguidas
    // antes do re-render nao se apagam.
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const currentWeek = toISO(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const setAnchor = (date: Date) => {
    const week = toISO(startOfWeek(date, { weekStartsOn: 1 }));
    update({ week: week === currentWeek ? null : week });
  };
  // Explicito: a escolha vale em qualquer largura de tela.
  const setView = (next: View) => update({ view: next });
  const setModality = (value: string) => update({ modality: value === ALL ? null : value });
  const setInstructor = (value: string) =>
    update({ instructor: value === ALL ? null : value });
  const clearFilters = () => update({ modality: null, instructor: null });

  return {
    anchor,
    view,
    modality,
    instructor,
    setAnchor,
    setView,
    setModality,
    setInstructor,
    clearFilters,
  };
}

export function TurmasCalendarView() {
  const {
    anchor,
    view,
    modality,
    instructor,
    setAnchor,
    setView,
    setModality,
    setInstructor,
    clearFilters,
  } = useCalendarFilters();

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
  const today = todayISO();

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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

        {/* No celular os filtros empilham em largura total para o texto caber. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por modalidade">
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
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por instrutor">
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
                ? clearFilters
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
                    // Mesma ocupacao da tela da aula: roster da data (com avulsos).
                    const full = s.occupiedCount >= s.capacity;
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
                                {s.isSubstitute ? (
                                  <span className="font-medium text-amber-600 dark:text-amber-400">
                                    {s.instructorName} (Subst.)
                                  </span>
                                ) : (
                                  s.instructorName
                                )}
                                {" · "}
                                <span
                                  className={cn(
                                    full && "font-medium text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {full
                                    ? `${s.occupiedCount}/${s.capacity} · Turma lotada`
                                    : `${s.occupiedCount}/${s.capacity} vagas`}
                                </span>
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
