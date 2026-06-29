"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { appointmentStatusLabel } from "@/lib/labels";
import type {
  AppointmentStatus,
  AppointmentView,
  ProfessionalView,
  TimeBlock,
} from "@/types";

// Janela visivel do dia (cobre Sab 08:00 e dias de semana ate 20:00).
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 72; // px por hora
const PX_PER_MIN = HOUR_HEIGHT / 60;
const DAY_START_MIN = HOUR_START * 60;
const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
const topOf = (start: string) => (toMin(start) - DAY_START_MIN) * PX_PER_MIN;
const heightOf = (start: string, end: string) =>
  Math.max((toMin(end) - toMin(start)) * PX_PER_MIN, 22);

// Cor por status (borda esquerda + leve tom de fundo).
const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "border-l-amber-400 bg-amber-50 dark:bg-amber-950/20",
  confirmed: "border-l-sky-400 bg-sky-50 dark:bg-sky-950/20",
  in_service: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
  completed: "border-l-zinc-300 bg-muted/40",
  canceled: "border-l-zinc-300 bg-muted/30",
  no_show: "border-l-rose-300 bg-rose-50/60 dark:bg-rose-950/10",
};

const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function AppointmentCard({
  appointment,
  onSelect,
}: {
  appointment: AppointmentView;
  onSelect?: (a: AppointmentView) => void;
}) {
  const dimmed = appointment.status === "no_show" || appointment.status === "completed";
  return (
    <button
      type="button"
      data-slot="appointment-card"
      onClick={() => onSelect?.(appointment)}
      style={{ top: topOf(appointment.start), height: heightOf(appointment.start, appointment.end) }}
      title={`${appointment.start}–${appointment.end} · ${appointment.client.name} · ${appointment.service.name} · ${appointmentStatusLabel(appointment.status)}`}
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left text-xs shadow-sm transition-colors hover:shadow",
        STATUS_STYLE[appointment.status],
        dimmed && "opacity-70",
      )}
    >
      <p className="font-medium leading-tight text-foreground">
        <span className="tabular-nums text-muted-foreground">{appointment.start}</span>{" "}
        {appointment.client.name}
      </p>
      <p className="truncate text-muted-foreground">{appointment.service.name}</p>
    </button>
  );
}

function BlockCard({ block }: { block: TimeBlock }) {
  return (
    <div
      data-slot="time-block"
      style={{ top: topOf(block.start), height: heightOf(block.start, block.end) }}
      title={`Bloqueado${block.reason ? ` · ${block.reason}` : ""}`}
      className="absolute inset-x-1 flex items-center gap-1 overflow-hidden rounded-md border border-dashed bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_6px,transparent_6px,transparent_12px)] px-2 py-1 text-xs text-muted-foreground"
    >
      <Lock className="size-3 shrink-0" />
      <span className="truncate">Bloqueado{block.reason ? ` · ${block.reason}` : ""}</span>
    </div>
  );
}

interface AgendaDayGridProps {
  professionals: ProfessionalView[];
  appointments: AppointmentView[];
  blocks: TimeBlock[];
  onSelectAppointment?: (a: AppointmentView) => void;
}

export function AgendaDayGrid({
  professionals,
  appointments,
  blocks,
  onSelectAppointment,
}: AgendaDayGridProps) {
  // Cancelados nao aparecem no grid operacional (ficam no historico/Agendamentos).
  const visible = appointments.filter((a) => a.status !== "canceled");

  return (
    <div data-slot="agenda-grid" className="overflow-x-auto rounded-lg border bg-card">
      <div className="flex min-w-max">
        {/* Eixo de horas */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card">
          <div className="h-10 border-b" />
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {HOURS.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* Colunas por profissional */}
        {professionals.map((prof) => {
          const profAppts = visible.filter((a) => a.professionalId === prof.id);
          const profBlocks = blocks.filter((b) => b.professionalId === prof.id);
          return (
            <div key={prof.id} className="w-48 shrink-0 border-r last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b px-2 text-sm font-medium">
                <span className="truncate">{prof.name}</span>
              </div>
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {HOURS.slice(1).map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: (i + 1) * HOUR_HEIGHT }}
                  />
                ))}
                {profBlocks.map((b) => (
                  <BlockCard key={b.id} block={b} />
                ))}
                {profAppts.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} onSelect={onSelectAppointment} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
