"use client";

import { useState, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Plus, RotateCw } from "lucide-react";
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
import { Combobox } from "@/components/shared/combobox";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
  SearchInput,
} from "@/components/shared/list";
import { formatCents } from "@gestarahub/core/format";
import { appointmentStatusLabel } from "@/lib/labels";
import { todayISO } from "@gestarahub/core/date";
import type { AppointmentStatus, AppointmentView } from "@gestarahub/contracts";
import { useCan, useCurrentUser, scopedProfessionalId } from "@/features/auth";
import { useProfessionals } from "@/features/professionals";
import { useAppointments } from "../hooks/use-appointments";
import { AppointmentStatusBadge } from "./appointment-status-badge";

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

interface ListPanelProps {
  /** Abre o detalhe do agendamento selecionado (dialogs vivem no AgendaView). */
  onSelectAppointment: (appointment: AppointmentView) => void;
  /** Abre o formulario de novo agendamento (acao do +Novo, no AgendaView). */
  onCreate: () => void;
}

/**
 * Aba "Lista": historico/listagem com filtros. So exibe e seleciona — a criacao
 * (+Novo) e todos os dialogs ficam no AgendaView (pai), compartilhados com a aba
 * Calendário.
 */
export function ListPanel({ onSelectAppointment, onCreate }: ListPanelProps) {
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

  const user = useCurrentUser();
  const can = useCan();
  const scopedProfId = scopedProfessionalId(user);
  const scoped = Boolean(scopedProfId);
  const canCreate = can("appointments:create");

  const { data: professionals } = useProfessionals({ status: "active" });
  const query = useAppointments({
    dateFrom,
    dateTo,
    professionalId:
      scopedProfId ?? (professionalId === "all" ? undefined : professionalId),
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
      <ListContainer>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="space-y-1 min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
          </div>
        ))}
      </ListContainer>
    );
  } else if (appointments.length === 0) {
    body = (
      <ListContainer
        emptyState={
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
            ) : canCreate ? (
              <Button size="sm" onClick={onCreate}>
                <Plus className="size-4" />
                Novo agendamento
              </Button>
            ) : null}
          </div>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date} className="space-y-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {formatGroupDate(group.date)}
            </p>
            <ListContainer>
              {group.items.map((appointment) => (
                <ListRow
                  key={appointment.id}
                  onClick={() => onSelectAppointment(appointment)}
                  canClick
                  actions={
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-sm text-muted-foreground sm:inline tabular-nums">
                        {formatCents(appointment.totalPriceCents)}
                      </span>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-24 shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {appointment.start}–{appointment.end}
                    </span>
                    <InitialsAvatar name={appointment.client.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {appointment.client.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.services.map((s) => s.name).join(" + ")} · {appointment.professional.name}
                      </p>
                    </div>
                  </div>
                </ListRow>
              ))}
            </ListContainer>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
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
            {scoped ? null : (
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
            )}
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
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Buscar por cliente..."
            aria-label="Buscar por cliente"
            className="lg:w-56"
          />
        </CardContent>
      </Card>

      {body}
    </>
  );
}
