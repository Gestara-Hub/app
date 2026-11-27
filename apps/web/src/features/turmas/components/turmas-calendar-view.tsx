"use client";

import { useTeamWords } from "@/features/settings";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppRouter } from "@/lib/use-app-router";
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
  Check,
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
import { useCalendarEventSessions, useClassSessions } from "../hooks/use-turmas";
import { classEntry, eventEntry, type CalendarEntry, type CalendarShow } from "../calendar-entries";
import { sessionLinkLabel } from "../turma-copy";
import { rememberCalendarQuery } from "../calendar-filters";
import { TurmasWeekGrid, dayLabel, entryColor } from "./turmas-week-grid";
import { EVENT_COLOR, NEUTRAL_MODALITY_COLOR, modalityColorMap, type ModalityColor } from "../modality-colors";
import { useCategories } from "@/features/categories";

type View = "grid" | "list";

const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const ALL = "all";
/** Chave do "Evento" na legenda (nao colide com nome de modalidade). */
const EVENT_KEY = "__event__";

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
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  // Ultima query pedida que o router ainda nao aplicou: cliques seguidos (duas
  // semanas para frente, dois filtros) partem dela, senao um apaga o outro.
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    rememberCalendarQuery(queryString);
    if (pendingQuery.current === queryString) pendingQuery.current = null;
  }, [queryString]);
  const currentParams = () => new URLSearchParams(pendingQuery.current ?? window.location.search);

  const weekParam = searchParams.get("week");
  const parsedWeek = weekParam ? parseISO(weekParam) : null;
  const anchor = parsedWeek && isValid(parsedWeek) ? parsedWeek : new Date();
  const isMobile = useIsMobile();
  const viewParam = searchParams.get("view");
  const view: View =
    viewParam === "list" || viewParam === "grid" ? viewParam : isMobile ? "list" : "grid";
  // Legenda com escolha multipla (11/11/2026): ?modality=Judô,Muay Thai; o Evento
  // marcado e ?show=events (o mesmo link que a tela de Eventos ja usa).
  const modalityParam = searchParams.get("modality");
  const instructor = searchParams.get("instructor") ?? ALL;
  // Vindo de uma turma ("Ver aulas no calendario"): so as aulas dela.
  const classGroupId = searchParams.get("class");
  // Turmas e eventos juntos (padrao), so turmas ou so eventos (doc product/29).
  const showParam = searchParams.get("show");
  const show: CalendarShow = showParam === "classes" || showParam === "events" ? showParam : "all";
  const selected = useMemo(() => {
    const set = new Set((modalityParam ?? "").split(",").map((v) => v.trim()).filter(Boolean));
    if (show === "events") set.add(EVENT_KEY);
    return set;
  }, [modalityParam, show]);

  const update = (patch: Record<string, string | null>) => {
    // Parte da URL atual (nao do snapshot do render): duas trocas seguidas
    // antes do re-render nao se apagam.
    const params = currentParams();
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    pendingQuery.current = query;
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const currentWeek = toISO(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const setAnchor = (date: Date) => {
    const week = toISO(startOfWeek(date, { weekStartsOn: 1 }));
    update({ week: week === currentWeek ? null : week });
  };
  // Semana anterior/proxima a partir da ultima pedida (nao da renderizada).
  const shiftWeek = (delta: number) => {
    const pending = currentParams().get("week");
    const parsed = pending ? parseISO(pending) : null;
    setAnchor(addWeeks(parsed && isValid(parsed) ? parsed : new Date(), delta));
  };
  // Explicito: a escolha vale em qualquer largura de tela.
  const setView = (next: View) => update({ view: next });
  const setInstructor = (value: string) =>
    update({ instructor: value === ALL ? null : value });
  /** Liga ou desliga um item da legenda (modalidade ou Evento); os outros ficam. */
  const toggleLegend = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const names = [...next].filter((k) => k !== EVENT_KEY);
    update({ modality: names.length ? names.join(",") : null, show: next.has(EVENT_KEY) ? "events" : null });
  };
  const clearLegend = () => update({ modality: null, show: null });
  const clearFilters = () => update({ modality: null, instructor: null, class: null, show: null });
  const clearClassGroup = () => update({ class: null });

  return {
    anchor,
    view,
    selected,
    instructor,
    classGroupId,
    show,
    toggleLegend,
    clearLegend,
    clearClassGroup,
    setAnchor,
    shiftWeek,
    setView,
    setInstructor,
    clearFilters,
  };
}

export function TurmasCalendarView() {
  const team = useTeamWords();
  const {
    anchor,
    view,
    selected,
    instructor,
    classGroupId,
    show,
    toggleLegend,
    clearLegend,
    clearClassGroup,
    setAnchor,
    shiftWeek,
    setView,
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
  const range = { dateFrom: toISO(weekStart), dateTo: toISO(weekEnd) };
  const { data: sessions, isLoading } = useClassSessions(range);
  const { data: eventSessions, isLoading: eventsLoading } = useCalendarEventSessions(range);

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = todayISO();

  // Aulas e dias de evento no mesmo formato; "so turmas" e "so eventos" tiram um lado.
  const entries = useMemo<CalendarEntry[]>(() => {
    const classes = (sessions ?? []).filter((s) => !classGroupId || s.classGroupId === classGroupId).map((s) => classEntry(s, sessionLinkLabel(s)));
    const events = show === "classes" || classGroupId ? [] : (eventSessions ?? []).map(eventEntry);
    return [...classes, ...events];
  }, [sessions, eventSessions, show, classGroupId]);

  // Cor de cada modalidade pela ordem de criacao (modality-colors.ts).
  const { data: modalities } = useCategories();
  const modalityColors = useMemo(() => modalityColorMap(modalities), [modalities]);

  const modalityOptions = useMemo(() => {
    const names = new Set(entries.map((s) => s.modalityName).filter(Boolean) as string[]);
    // As marcadas ficam na legenda mesmo sem aula na semana, para dar para desmarcar.
    for (const key of selected) if (key !== EVENT_KEY) names.add(key);
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, selected]);

  const instructorOptions = useMemo(() => {
    const names = new Set(entries.map((s) => s.instructorName));
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (s) =>
          // Cada item da legenda mostra os cards da sua cor: Evento todos os eventos, a modalidade as aulas dela.
          (selected.size === 0 || (s.kind === "event" ? selected.has(EVENT_KEY) : Boolean(s.modalityName && selected.has(s.modalityName)))) &&
          (instructor === ALL || s.instructorName === instructor),
      ),
    [entries, selected, instructor],
  );
  const hasEvents = (eventSessions ?? []).length > 0;

  const hasFilters = selected.size > 0 || instructor !== ALL || Boolean(classGroupId) || show !== "all";
  const filteredClassName = classGroupId
    ? (sessions ?? []).find((s) => s.classGroupId === classGroupId)?.className
    : undefined;
  void sessions;

  return (
    <>
      <PageHeader
        title="Calendário de turmas"
        description="Aulas e eventos da semana."
      >
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Semana anterior"
            onClick={() => shiftWeek(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próxima semana"
            onClick={() => shiftWeek(1)}
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
          <Select value={instructor} onValueChange={setInstructor}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label={`Filtrar por ${team.lower}`}>
              <SelectValue placeholder={team.title} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{`Todos os ${team.lowerPlural}`}</SelectItem>
              {instructorOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legenda (11/11/2026): cada cor e uma modalidade e clicar filtra (substitui o
          seletor de modalidade); Evento e "Ja passou" so explicam. */}
      {modalityOptions.length > 0 || hasEvents || show !== "all" ? (
        <CalendarLegend
          modalities={modalityOptions}
          colors={modalityColors}
          selected={selected}
          onToggle={toggleLegend}
          onClear={clearLegend}
          showEvent={(hasEvents || show === "events") && !classGroupId}
          showPast={view === "grid"}
        />
      ) : null}

      {classGroupId ? (
        <p className="mb-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>Só as aulas {filteredClassName ? `da turma ${filteredClassName}` : "desta turma"}.</span>
          <button
            type="button"
            onClick={clearClassGroup}
            className="cursor-pointer font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Ver todas
          </button>
        </p>
      ) : null}

      {!mounted || isLoading || eventsLoading ? (
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
                ? `Ajuste modalidade ou ${team.lower} para ver a grade.`
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
        <div data-guide-list>
          <TurmasWeekGrid days={days} entries={filtered} colors={modalityColors} />
        </div>
      ) : (
        <div data-guide-list className="space-y-4">
          {days.map((d) => {
            const iso = toISO(d);
            // Por horario: aulas e eventos misturados (antes os eventos vinham depois de todas as aulas).
            const daySessions = filtered
              .filter((s) => s.date === iso)
              .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "pt-BR"));
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
                    const isEvent = s.kind === "event";
                    return (
                      <Link key={s.id} href={s.href} className="block">
                        <ListItemCard
                          className={cn("pl-4", entryColor(s, modalityColors).tint)}
                          accentClassName={entryColor(s, modalityColors).dot}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                                {isEvent ? (
                                  <span className="inline-flex items-center rounded-sm bg-violet-500/20 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                    Evento
                                  </span>
                                ) : null}
                                <span className="min-w-0 break-words">{s.title}</span>
                              </p>
                              <p className="min-w-0 break-words text-xs text-muted-foreground">
                                {s.modalityName ? `${s.modalityName} · ` : ""}
                                {s.isSubstitute ? (
                                  <span className="font-medium text-amber-700 dark:text-amber-400">
                                    {s.instructorName} (Subst.)
                                  </span>
                                ) : (
                                  `${s.instructorName}${s.isGuest ? " (convidado)" : ""}`
                                )}
                                {" · "}
                                <span className={cn(s.isFull && "font-medium text-amber-700 dark:text-amber-400")}>{s.occupancy}</span>
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

/**
 * Linha de legenda do Calendario: as modalidades da semana com a cor de cada
 * uma (botoes: um clique filtra, outro volta a todas), o Evento e, na grade, a
 * amostra apagada do que ja passou. No celular a linha rola para o lado.
 */
function CalendarLegend({
  modalities,
  colors,
  selected,
  onToggle,
  onClear,
  showEvent,
  showPast,
}: {
  modalities: string[];
  colors: Map<string, ModalityColor>;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  showEvent: boolean;
  showPast: boolean;
}) {
  const filtering = selected.size > 0;
  return (
    // Quebra linha em qualquer largura (11/11/2026): no celular a rolagem lateral escondia itens.
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <div role="group" aria-label="Filtrar por modalidade ou evento" className="flex flex-wrap items-center gap-1.5">
        {modalities.map((name) => (
          <LegendChip
            key={name}
            label={name}
            dot={colors.get(name)?.dot ?? NEUTRAL_MODALITY_COLOR.dot}
            pressed={selected.has(name)}
            dimmed={filtering}
            onClick={() => onToggle(name)}
          />
        ))}
        {showEvent ? (
          <LegendChip
            label="Evento"
            dot={EVENT_COLOR.dot}
            pressed={selected.has(EVENT_KEY)}
            dimmed={filtering}
            onClick={() => onToggle(EVENT_KEY)}
          />
        ) : null}
        {filtering ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 cursor-pointer items-center px-1.5 py-1 text-xs font-medium text-primary hover:underline"
          >
            Mostrar todas
          </button>
        ) : null}
      </div>
      {/* Separador so quando cabe na mesma linha (no celular ele sobrava sozinho no comeco da linha). */}
      {showPast ? <span aria-hidden className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:block" /> : null}
      {showPast ? (
        // Amostra = um card em miniatura apagado, igual ao da grade (o quadrado cinza nao dizia nada).
        <span
          className="inline-flex shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground"
          title="Aulas e eventos que já aconteceram ficam apagados. Clique neles para ver a chamada."
        >
          <span className="h-3 w-5 shrink-0 rounded-[3px] border border-l-[3px] border-blue-500/40 border-l-blue-500 bg-blue-500/10 opacity-55" aria-hidden />
          Apagado = já passou
        </span>
      ) : null}
    </div>
  );
}

/** Item da legenda: liga e desliga (varios ao mesmo tempo); marcado ganha borda e ✓. */
function LegendChip({
  label,
  dot,
  pressed,
  dimmed,
  onClick,
}: {
  label: string;
  dot: string;
  pressed: boolean;
  /** Outro item da legenda esta filtrando. */
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={pressed ? `Tirar ${label} do filtro` : `Mostrar ${label}`}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        pressed
          ? "border-foreground/30 bg-muted font-medium text-foreground"
          : dimmed
            ? "border-transparent text-muted-foreground/70 hover:text-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {pressed ? <Check className="size-3" aria-hidden /> : <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />}
      {label}
    </button>
  );
}
