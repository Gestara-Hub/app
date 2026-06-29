"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { weekdayOf } from "@/lib/scheduling";
import { REFERENCE_DATE } from "@/config/tenant";
import type { AppointmentView } from "@/types";
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
import { useAppointments } from "../hooks/use-appointments";
import { useTimeBlocks } from "../hooks/use-time-blocks";
import { AgendaDayGrid } from "./agenda-day-grid";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";

function formatDateLabel(date: string): string {
  const label = format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AgendaView() {
  const [date, setDate] = useState(REFERENCE_DATE);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<AppointmentView | null>(null);

  const range = { dateFrom: date, dateTo: date };
  const professionalsQuery = useProfessionals({ status: "active" });
  const appointmentsQuery = useAppointments(range);
  const blocksQuery = useTimeBlocks(range);

  // Mostra apenas quem atende neste dia da semana (sem coluna de quem esta de folga).
  const weekday = weekdayOf(date);
  const professionals = (professionalsQuery.data ?? []).filter((p) =>
    p.workingHours.some((w) => w.weekday === weekday),
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
      <PageHeader title="Agenda" description="Agenda diária por profissional.">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          Novo agendamento
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" aria-label="Dia anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(REFERENCE_DATE)}>
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
          <AgendaDayGrid
            professionals={professionals}
            appointments={appointments}
            blocks={blocks}
            onSelectAppointment={setSelected}
          />
        </>
      )}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={date}
      />

      <AppointmentDetailDialog
        appointment={selected}
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
      />
    </>
  );
}
