"use client";

import { useState, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Plus, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { Combobox } from "@/components/shared/combobox";
import { ListItemCard } from "@/components/shared/list-item-card";
import { formatCents } from "@/lib/format";
import { appointmentStatusLabel } from "@/lib/labels";
import { todayISO } from "@/lib/date";
import type { AppointmentStatus, AppointmentView } from "@/types";
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
import { useAppointments } from "../hooks/use-appointments";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { RescheduleDialog } from "./reschedule-appointment-dialog";

const STATUS_VALUES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "in_service",
  "completed",
  "canceled",
  "no_show",
];

function formatGroupDate(date: string): string {
  const label = format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return date === todayISO() ? `${capitalized} (hoje)` : capitalized;
}

function groupByDate(appointments: AppointmentView[]) {
  const groups: { date: string; items: AppointmentView[] }[] = [];
  for (const a of appointments) {
    const last = groups[groups.length - 1];
    if (last && last.date === a.date) last.items.push(a);
    else groups.push({ date: a.date, items: [a] });
  }
  return groups;
}

export function AppointmentsView() {
  const today = todayISO();
  const [dateFrom, setDateFrom] = useState(
    format(addDays(parseISO(today), -5), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(
    format(addDays(parseISO(today), 7), "yyyy-MM-dd"),
  );
  const [professionalId, setProfessionalId] = useState("all");
  const [status, setStatus] = useState<"all" | AppointmentStatus>("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<AppointmentView | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [formState, setFormState] = useState<{
    open: boolean;
    appointment?: AppointmentView;
  }>({ open: false });

  const { data: professionals } = useProfessionals({ status: "active" });
  const query = useAppointments({
    dateFrom,
    dateTo,
    professionalId: professionalId === "all" ? undefined : professionalId,
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
  });
  const appointments = query.data ?? [];
  const groups = groupByDate(appointments);

  const hasFilters =
    professionalId !== "all" || status !== "all" || Boolean(search.trim());
  const clearAll = () => {
    setProfessionalId("all");
    setStatus("all");
    setSearch("");
  };

  let body: ReactNode;
  if (query.isError) {
    body = (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os agendamentos. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (query.isPending) {
    body = (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  } else if (appointments.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CalendarClock className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "Nenhum resultado para os filtros aplicados."
            : "Nenhum agendamento neste período."}
        </p>
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={clearAll}>
            Limpar filtros
          </Button>
        ) : (
          <Button size="sm" onClick={() => setFormState({ open: true })}>
            <Plus className="size-4" />
            Novo agendamento
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {formatGroupDate(group.date)}
            </p>
            {group.items.map((appointment) => (
              <ListItemCard
                key={appointment.id}
                data-slot="appointment-row"
                role="button"
                tabIndex={0}
                onClick={() => setSelected(appointment)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(appointment);
                  }
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium tabular-nums">
                      {appointment.start}–{appointment.end}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{appointment.client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.service.name} · {appointment.professional.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-sm text-muted-foreground sm:inline">
                      {formatCents(appointment.service.priceCents)}
                    </span>
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                </div>
              </ListItemCard>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Agendamentos" description="Lista e histórico de agendamentos.">
        <Button onClick={() => setFormState({ open: true })}>
          <Plus className="size-4" />
          Novo agendamento
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              De
              <Input
                type="date"
                aria-label="Data inicial"
                value={dateFrom}
                onChange={(e) => e.target.value && setDateFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Até
              <Input
                type="date"
                aria-label="Data final"
                value={dateTo}
                onChange={(e) => e.target.value && setDateTo(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Profissional
              <Combobox
                value={professionalId}
                onChange={setProfessionalId}
                options={[
                  { label: "Todos", value: "all" },
                  ...(professionals ?? []).map((p) => ({ label: p.name, value: p.id })),
                ]}
                placeholder="Todos"
                searchPlaceholder="Buscar profissional..."
                emptyMessage="Nenhum profissional."
                ariaLabel="Filtrar por profissional"
              />
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Status
              <Select value={status} onValueChange={(v) => setStatus(v as "all" | AppointmentStatus)}>
                <SelectTrigger className="w-full" aria-label="Filtrar por status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {appointmentStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="relative lg:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              className="px-8"
              autoComplete="off"
              aria-label="Buscar por cliente"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {body}

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

      <AppointmentFormDialog
        open={formState.open}
        onOpenChange={(next) => {
          if (!next) setFormState({ open: false });
        }}
        appointment={formState.appointment}
      />
    </>
  );
}
