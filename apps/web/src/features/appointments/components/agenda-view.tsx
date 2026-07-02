"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  List,
  Lock,
  Plus,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import type { AppointmentView } from "@/types";
import { useCan, useCurrentUser } from "@/features/auth/session-provider";
import { scopedProfessionalId } from "@/features/auth/scope";
import { CalendarPanel } from "./calendar-panel";
import { ListPanel } from "./list-panel";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { RescheduleDialog } from "./reschedule-appointment-dialog";
import { BlockFormDialog } from "./block-form-dialog";
import { SeriesFormDialog } from "./series-form-dialog";

type Tab = "calendario" | "lista";

const TABS: { value: Tab; label: string; icon: typeof CalendarDays }[] = [
  { value: "calendario", label: "Calendário", icon: CalendarDays },
  { value: "lista", label: "Lista", icon: List },
];

/**
 * Tela unica de Agenda com duas abas: Calendário (grade diaria) e Lista
 * (historico com filtros) — duas visoes do mesmo agendamento. O header, o
 * +Novo e todos os dialogs (criar/editar/bloqueio/serie/detalhe/remarcar) vivem
 * aqui e sao compartilhados pelas duas abas; cada painel cuida so dos proprios
 * dados e da selecao.
 */
export function AgendaView() {
  const [tab, setTab] = useState<Tab>("calendario");
  const [formState, setFormState] = useState<{
    open: boolean;
    appointment?: AppointmentView;
    defaultProfessionalId?: string;
    defaultDate?: string;
    defaultStart?: string;
  }>({ open: false });
  const [blockOpen, setBlockOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [selected, setSelected] = useState<AppointmentView | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);

  const user = useCurrentUser();
  const can = useCan();
  const scoped = Boolean(scopedProfessionalId(user));
  const canCreate = can("appointments:create");
  const canBlock = can("appointments:block");
  const canSeries = can("recurrence:manage");
  const showNew = canCreate || canBlock || canSeries;

  const openCreate = () => setFormState({ open: true });
  // Clique num espaco vago do calendario abre o form ja com profissional, data e
  // horario preenchidos.
  const openCreateAt = (args: {
    professionalId: string;
    date: string;
    start: string;
  }) =>
    setFormState({
      open: true,
      defaultProfessionalId: args.professionalId,
      defaultDate: args.date,
      defaultStart: args.start,
    });

  return (
    <>
      <PageHeader
        title={scoped ? "Minha agenda" : "Agenda"}
        description={
          scoped
            ? "Seus agendamentos — calendário e lista."
            : "Calendário por período e lista de agendamentos."
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
                <DropdownMenuItem onSelect={openCreate}>
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

      <div
        role="tablist"
        aria-label="Visão da agenda"
        className="mb-4 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`agenda-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`agenda-panel-${t.value}`}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Ambos os paineis ficam montados; alternamos so a visibilidade para
          preservar data/filtros ao trocar de aba (e trocar instantaneo). */}
      <div
        role="tabpanel"
        id="agenda-panel-calendario"
        aria-labelledby="agenda-tab-calendario"
        hidden={tab !== "calendario"}
      >
        <CalendarPanel
          onSelectAppointment={setSelected}
          onCreateAppointment={canCreate ? openCreateAt : undefined}
        />
      </div>
      <div
        role="tabpanel"
        id="agenda-panel-lista"
        aria-labelledby="agenda-tab-lista"
        hidden={tab !== "lista"}
      >
        <ListPanel onSelectAppointment={setSelected} onCreate={openCreate} />
      </div>

      <AppointmentFormDialog
        open={formState.open}
        onOpenChange={(next) => {
          if (!next) setFormState((state) => ({ ...state, open: false }));
        }}
        appointment={formState.appointment}
        defaultProfessionalId={formState.defaultProfessionalId}
        defaultDate={formState.defaultDate}
        defaultStart={formState.defaultStart}
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
