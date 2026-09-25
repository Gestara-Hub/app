"use client";

import { useState, type ReactNode } from "react";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { formatCents } from "@gestarahub/core/format";
import { appointmentStatusLabel } from "@/lib/labels";
import { todayISO } from "@gestarahub/core/date";
import { cn } from "@/lib/utils";
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
  const defaultDateFrom = format(addDays(parseISO(today), -5), "yyyy-MM-dd");
  const defaultDateTo = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
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
    professionalId !== "all" ||
    status !== "all" ||
    Boolean(search.trim()) ||
    dateFrom !== defaultDateFrom ||
    dateTo !== defaultDateTo;

  const clearAll = () => {
    setProfessionalId("all");
    setStatus("all");
    setSearch("");
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
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
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="space-y-3">
        {/* Linha 1: Busca e Seletores de Profissional e Status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Buscar por cliente..."
            aria-label="Buscar por cliente"
            className="flex-1"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            {scoped ? null : (
              <div className="w-full sm:w-48">
                <Combobox
                  value={professionalId}
                  onChange={setProfessionalId}
                  options={[
                    { label: "Todos os profissionais", value: "all" },
                    ...(professionals ?? []).map((p) => ({
                      label: p.name,
                      value: p.id,
                    })),
                  ]}
                  placeholder="Todos os profissionais"
                  searchPlaceholder="Buscar profissional..."
                  emptyMessage="Nenhum profissional."
                  ariaLabel="Filtrar por profissional"
                />
              </div>
            )}

            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v as "all" | AppointmentStatus)
              }
            >
              <SelectTrigger
                className="w-full sm:w-44"
                aria-label="Filtrar por status"
              >
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {appointmentStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 2: Intervalo de Datas, Atalhos Rápidos e Resumo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              Período:
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                aria-label="Data inicial"
                value={dateFrom}
                onChange={(e) => e.target.value && setDateFrom(e.target.value)}
                className="h-9 w-36 sm:w-40"
              />
              <span className="text-xs text-muted-foreground shrink-0">até</span>
              <Input
                type="date"
                aria-label="Data final"
                value={dateTo}
                onChange={(e) => e.target.value && setDateTo(e.target.value)}
                className="h-9 w-36 sm:w-40"
              />
            </div>

            <div className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDateFrom(today);
                  setDateTo(today);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-medium transition-colors",
                  dateFrom === today && dateTo === today
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFrom(today);
                  setDateTo(format(addDays(parseISO(today), 7), "yyyy-MM-dd"));
                }}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-medium transition-colors",
                  dateFrom === today &&
                    dateTo === format(addDays(parseISO(today), 7), "yyyy-MM-dd")
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Próximos 7 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseISO(today);
                  setDateFrom(format(startOfMonth(parsed), "yyyy-MM-dd"));
                  setDateTo(format(endOfMonth(parsed), "yyyy-MM-dd"));
                }}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-medium transition-colors",
                  dateFrom ===
                    format(startOfMonth(parseISO(today)), "yyyy-MM-dd") &&
                    dateTo === format(endOfMonth(parseISO(today)), "yyyy-MM-dd")
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Este mês
              </button>
            </div>
          </div>

          {!query.isError ? (
            <ListSummaryBar
              isLoading={query.isPending}
              count={appointments.length}
              singularLabel="agendamento"
              pluralLabel="agendamentos"
              hasFilters={hasFilters}
              onClearFilters={clearAll}
              className="flex items-center gap-3 text-xs text-muted-foreground"
            />
          ) : null}
        </div>
      </div>

      {body}
    </div>
  );
}
