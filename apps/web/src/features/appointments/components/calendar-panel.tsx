"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { weekdayOf } from "@gestarahub/core/scheduling";
import { todayISO } from "@gestarahub/core/date";
import type { AppointmentView } from "@gestarahub/contracts";
import { useCurrentUser, scopedProfessionalId } from "@/features/auth";
import { useProfessionals } from "@/features/professionals";
import { useUnit } from "@/features/settings";
import { useAppointments } from "../hooks/use-appointments";
import { useTimeBlocks } from "../hooks/use-time-blocks";
import { useCalendarProfessionalFilter } from "../hooks/use-calendar-professional-filter";
import { ProfessionalFilter } from "./professional-filter";
import {
  ScheduleDayGrid,
  ScheduleMonthGrid,
  ScheduleWeekGrid,
} from "./schedule-day-grid";

function formatDateLabel(date: string): string {
  const label = format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type CalendarMode = "day" | "week" | "month";

function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function calendarRange(date: string, mode: CalendarMode) {
  const parsed = parseISO(date);
  if (mode === "week") {
    const start = startOfWeek(parsed, { weekStartsOn: 1 });
    const end = endOfWeek(parsed, { weekStartsOn: 1 });
    return { dateFrom: toISO(start), dateTo: toISO(end) };
  }
  if (mode === "month") {
    const monthStart = startOfMonth(parsed);
    const monthEnd = endOfMonth(parsed);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return { dateFrom: toISO(start), dateTo: toISO(end) };
  }
  return { dateFrom: date, dateTo: date };
}

function formatRangeLabel(date: string, mode: CalendarMode): string {
  const parsed = parseISO(date);
  if (mode === "week") {
    const start = startOfWeek(parsed, { weekStartsOn: 1 });
    const end = endOfWeek(parsed, { weekStartsOn: 1 });
    return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
  }
  if (mode === "month") {
    const label = format(parsed, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return formatDateLabel(date);
}

interface CalendarPanelProps {
  /** Abre o detalhe do agendamento selecionado (dialogs vivem no AgendaView). */
  onSelectAppointment: (appointment: AppointmentView) => void;
  /** Clique num espaco vago cria um agendamento no profissional/horario; ausente
   *  quando o usuario nao pode criar. */
  onCreateAppointment?: (args: {
    professionalId: string;
    date: string;
    start: string;
  }) => void;
}

/**
 * Aba "Calendário": grade diária por profissional. So exibe e seleciona — a
 * criacao (+Novo) e todos os dialogs ficam no AgendaView (pai), compartilhados
 * com a aba Lista.
 */
export function CalendarPanel({
  onSelectAppointment,
  onCreateAppointment,
}: CalendarPanelProps) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<CalendarMode>("day");
  const [profFilter, setProfFilter] = useCalendarProfessionalFilter();

  const user = useCurrentUser();
  const scopedProfId = scopedProfessionalId(user);

  const range = calendarRange(date, mode);
  const unitQuery = useUnit();
  const professionalsQuery = useProfessionals({ status: "active" });
  const appointmentsQuery = useAppointments(
    scopedProfId ? { ...range, professionalId: scopedProfId } : range,
  );
  const blocksQuery = useTimeBlocks(range);

  // Mostra quem atende neste dia da semana (sem coluna de quem esta de folga).
  // Profissional SEM disponibilidade definida (workingHours vazio) e tratado como
  // "atende qualquer dia" e aparece em todo dia aberto — coerente com a regra
  // mole: agendar fora do horario apenas pede confirmacao. Perfil Profissional ve
  // apenas a propria coluna.
  const weekday = weekdayOf(date);
  const activeProfessionals = professionalsQuery.data ?? [];
  // "Todos" (profFilter null) = sem filtro nenhum; perfil Profissional (scoped)
  // ve apenas a propria coluna independente do filtro.
  const showAllProfs = !scopedProfId && profFilter === null;
  const selectedProfs = new Set(scopedProfId ? [scopedProfId] : (profFilter ?? []));
  const isProfVisible = (id: string) => showAllProfs || selectedProfs.has(id);
  const attendsOn = (p: (typeof activeProfessionals)[number]) =>
    p.workingHours.length === 0 || p.workingHours.some((w) => w.weekday === weekday);
  const professionals = activeProfessionals.filter(
    (p) =>
      attendsOn(p) &&
      (!scopedProfId || p.id === scopedProfId) &&
      isProfVisible(p.id),
  );
  const appointments = (appointmentsQuery.data ?? []).filter((a) =>
    isProfVisible(a.professionalId),
  );
  const blocks = blocksQuery.data ?? [];
  const rangeDays = eachDayOfInterval({
    start: parseISO(range.dateFrom),
    end: parseISO(range.dateTo),
  }).map(toISO);
  const weekDays =
    mode === "week"
      ? eachDayOfInterval({
          start: startOfWeek(parseISO(date), { weekStartsOn: 1 }),
          end: endOfWeek(parseISO(date), { weekStartsOn: 1 }),
        }).map(toISO)
      : [];

  const shift = (direction: -1 | 1) => {
    const parsed = parseISO(date);
    const next =
      mode === "month"
        ? addMonths(parsed, direction)
        : mode === "week"
          ? addWeeks(parsed, direction)
          : addDays(parsed, direction);
    setDate(toISO(next));
  };

  const isPending =
    unitQuery.isPending ||
    professionalsQuery.isPending ||
    appointmentsQuery.isPending ||
    blocksQuery.isPending;
  const isError =
    unitQuery.isError ||
    professionalsQuery.isError ||
    appointmentsQuery.isError ||
    blocksQuery.isError;
  const businessHours = unitQuery.data?.businessHours ?? [];
  const hasConfiguredHours = businessHours.some((b) => !b.closed);
  const businessDay = businessHours.find((b) => b.weekday === weekday);
  const isClosed =
    hasConfiguredHours &&
    (!businessDay ||
      businessDay.closed ||
      (businessDay.shifts
        ? businessDay.shifts.length === 0
        : !businessDay.start || !businessDay.end));
  const appointmentCount = appointments.filter((a) => a.status !== "canceled").length;
  const emptyMessage =
    mode === "day"
      ? "Nenhum agendamento neste dia."
      : mode === "week"
        ? "Nenhum agendamento nesta semana."
        : "Nenhum agendamento neste mês.";
  const showProfFilter = !scopedProfId && activeProfessionals.length > 1;
  const noProfSelected =
    !scopedProfId && profFilter !== null && profFilter.length === 0;

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="icon-sm" aria-label="Anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant={date === today ? "default" : "outline"}
            size="sm"
            onClick={() => setDate(today)}
            className={cn(date === today && "shadow-xs")}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Próximo" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <p className="ml-2 text-sm font-medium">{formatRangeLabel(date, mode)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showProfFilter ? (
            <ProfessionalFilter
              professionals={activeProfessionals}
              value={profFilter}
              onChange={setProfFilter}
            />
          ) : null}
          <div className="inline-flex rounded-md border bg-muted/40 p-1">
            {[
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value as CalendarMode)}
                className={`rounded-sm px-3 py-1 text-sm font-medium transition-colors ${
                  mode === value
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            aria-label="Escolher data"
            className="sm:w-44"
          />
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a agenda. Tente novamente.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              unitQuery.refetch();
              appointmentsQuery.refetch();
              blocksQuery.refetch();
            }}
          >
            <RotateCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-[520px] w-full rounded-lg" />
      ) : (
        <>
          {appointmentCount === 0 && !noProfSelected ? (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4" />
              {emptyMessage}
            </div>
          ) : null}
          {noProfSelected ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <Users className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum profissional selecionado.</p>
              <p className="text-sm text-muted-foreground">
                Selecione ao menos um profissional no filtro para ver a agenda.
              </p>
            </div>
          ) : mode === "day" && !hasConfiguredHours ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <CalendarClock className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Horário de funcionamento ainda não configurado.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Configure os dias e horários de funcionamento da unidade para
                abrir a grade visual da agenda.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/settings?tab=horarios">Configurar horários</Link>
              </Button>
            </div>
          ) : mode === "day" && isClosed ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <CalendarClock className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Unidade fechada nesta data.</p>
              <p className="text-sm text-muted-foreground">
                Ajuste o funcionamento em Configurações para abrir horários neste dia.
              </p>
            </div>
          ) : mode === "day" ? (
            <ScheduleDayGrid
              date={date}
              businessStart={businessDay!.start!}
              businessEnd={businessDay!.end!}
              professionals={professionals}
              appointments={appointments}
              blocks={blocks}
              onSelectAppointment={onSelectAppointment}
              onCreateAppointment={onCreateAppointment}
            />
          ) : mode === "week" ? (
            <ScheduleWeekGrid
              days={weekDays}
              appointments={appointments}
              onSelectDay={(day) => {
                setDate(day);
                setMode("day");
              }}
            />
          ) : (
            <ScheduleMonthGrid
              monthDate={date}
              days={rangeDays}
              appointments={appointments}
              onSelectDay={(day) => {
                setDate(day);
                setMode("day");
              }}
            />
          )}
        </>
      )}
    </>
  );
}
