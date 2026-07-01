"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Repeat,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { weekdayOf } from "@/lib/scheduling";
import { todayISO } from "@/lib/date";
import type { AppointmentView } from "@/types";
import { useCan, useCurrentUser } from "@/features/auth/session-provider";
import { scopedProfessionalId } from "@/features/auth/scope";
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
import { useAppointments } from "../hooks/use-appointments";
import { useTimeBlocks } from "../hooks/use-time-blocks";
import { ScheduleDayGrid } from "./schedule-day-grid";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { RescheduleDialog } from "./reschedule-appointment-dialog";
import { BlockFormDialog } from "./block-form-dialog";
import { SeriesFormDialog } from "./series-form-dialog";

function formatDateLabel(date: string): string {
  const label = format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ScheduleView() {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [formState, setFormState] = useState<{
    open: boolean;
    appointment?: AppointmentView;
  }>({ open: false });
  const [blockOpen, setBlockOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [selected, setSelected] = useState<AppointmentView | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);

  const user = useCurrentUser();
  const can = useCan();
  const scopedProfId = scopedProfessionalId(user);
  const scoped = Boolean(scopedProfId);
  const canCreate = can("appointments:create");
  const canBlock = can("appointments:block");
  const canSeries = can("recurrence:manage");
  const showNew = canCreate || canBlock || canSeries;

  const range = { dateFrom: date, dateTo: date };
  const professionalsQuery = useProfessionals({ status: "active" });
  const appointmentsQuery = useAppointments(
    scopedProfId ? { ...range, professionalId: scopedProfId } : range,
  );
  const blocksQuery = useTimeBlocks(range);

  // Mostra apenas quem atende neste dia da semana (sem coluna de quem esta de
  // folga). Perfil Profissional ve apenas a propria coluna.
  const weekday = weekdayOf(date);
  const professionals = (professionalsQuery.data ?? []).filter(
    (p) =>
      p.workingHours.some((w) => w.weekday === weekday) &&
      (!scopedProfId || p.id === scopedProfId),
  );
  const appointments = appointmentsQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];

  const shift = (days: number) =>
    setDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));

  const isPending =
    professionalsQuery.isPending || appointmentsQuery.isPending || blocksQuery.isPending;
  const isError =
    professionalsQuery.isError || appointmentsQuery.isError || blocksQuery.isError;
  const dayCount = appointments.filter((a) => a.status !== "canceled").length;

  return (
    <>
      <PageHeader
        title={scoped ? "Minha agenda" : "Agenda"}
        description={
          scoped
            ? "Seus agendamentos do dia."
            : "Agenda diária por profissional."
        }
      >
        {showNew ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Novo
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {canCreate ? (
                <DropdownMenuItem onSelect={() => setFormState({ open: true })}>
                  <CalendarPlus className="size-4" />
                  Agendamento
                </DropdownMenuItem>
              ) : null}
              {canBlock ? (
                <DropdownMenuItem onSelect={() => setBlockOpen(true)}>
                  <Lock className="size-4" />
                  Bloqueio
                </DropdownMenuItem>
              ) : null}
              {canSeries ? (
                <DropdownMenuItem onSelect={() => setSeriesOpen(true)}>
                  <Repeat className="size-4" />
                  Série recorrente
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" aria-label="Dia anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(today)}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Próximo dia" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <p className="ml-2 text-sm font-medium">{formatDateLabel(date)}</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
          aria-label="Escolher data"
          className="sm:w-44"
        />
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
          {dayCount === 0 ? (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4" />
              Nenhum agendamento neste dia.
            </div>
          ) : null}
          <ScheduleDayGrid
            date={date}
            professionals={professionals}
            appointments={appointments}
            blocks={blocks}
            onSelectAppointment={setSelected}
          />
        </>
      )}

      <AppointmentFormDialog
        open={formState.open}
        onOpenChange={(next) => {
          if (!next) setFormState({ open: false });
        }}
        appointment={formState.appointment}
      />

      <BlockFormDialog open={blockOpen} onOpenChange={setBlockOpen} />

      <SeriesFormDialog open={seriesOpen} onOpenChange={setSeriesOpen} />

      <AppointmentDetailDialog
        appointment={selected}
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        onEdit={(appointment) => {
          setSelected(null);
          setFormState({ open: true, appointment });
        }}
        onReschedule={(appointment) => {
          setSelected(null);
          setRescheduling(appointment);
        }}
      />

      <RescheduleDialog
        appointment={rescheduling}
        open={rescheduling !== null}
        onOpenChange={(next) => {
          if (!next) setRescheduling(null);
        }}
      />
    </>
  );
}
