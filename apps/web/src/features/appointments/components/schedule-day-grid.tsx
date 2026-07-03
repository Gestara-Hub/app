"use client";

import { format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Coffee, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { appointmentStatusLabel } from "@/lib/labels";
import { weekdayOf } from "@gestarahub/core/scheduling";
import { todayISO } from "@gestarahub/core/date";
import type {
  AppointmentStatus,
  AppointmentView,
  ProfessionalView,
  TimeBlock,
} from "@gestarahub/contracts";

// Escala vertical da janela diaria.
const HOUR_HEIGHT = 72; // px por hora
const PX_PER_MIN = HOUR_HEIGHT / 60;
const DAY_MIN = 0;
const DAY_MAX = 23 * 60 + 59;
const GRID_Y_PADDING = 18;

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function expandedBusinessWindow(start: string, end: string) {
  return {
    startMin: Math.max(DAY_MIN, toMin(start) - 60),
    endMin: Math.min(DAY_MAX, toMin(end) + 60),
  };
}
const topOf = (start: string, dayStartMin: number) =>
  (toMin(start) - dayStartMin) * PX_PER_MIN;
const heightOf = (start: string, end: string) =>
  Math.max((toMin(end) - toMin(start)) * PX_PER_MIN, 22);

const SNAP_MIN = 15;
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Primeiro slot de 15 min livre a partir de `startMin`, pulando os intervalos
// ocupados (agendamentos, almoco e bloqueios do profissional). Se tudo estiver
// ocupado ate o fim do dia, volta ao inicio — o form valida no submit.
function firstFreeSlot(
  startMin: number,
  busy: [number, number][],
  dayEndMin: number,
): number {
  const maxMin = dayEndMin;
  for (let t = startMin; t < maxMin; t += SNAP_MIN) {
    if (!busy.some(([s, e]) => t >= s && t < e)) return t;
  }
  return startMin;
}

// Cor por status (borda esquerda + leve tom de fundo).
const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "border-l-amber-400 bg-amber-50 dark:bg-amber-950/20",
  confirmed: "border-l-sky-400 bg-sky-50 dark:bg-sky-950/20",
  in_service: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
  completed: "border-l-zinc-300 bg-muted/40",
  canceled: "border-l-zinc-300 bg-muted/30",
  no_show: "border-l-rose-300 bg-rose-50/60 dark:bg-rose-950/10",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-sky-400",
  in_service: "bg-emerald-500",
  completed: "bg-zinc-400",
  canceled: "bg-zinc-300",
  no_show: "bg-rose-300",
};

function AppointmentCard({
  appointment,
  dayStartMin,
  onSelect,
}: {
  appointment: AppointmentView;
  dayStartMin: number;
  onSelect?: (a: AppointmentView) => void;
}) {
  const dimmed = appointment.status === "no_show" || appointment.status === "completed";
  return (
    <button
      type="button"
      data-slot="appointment-card"
      onClick={() => onSelect?.(appointment)}
      style={{
        top: topOf(appointment.start, dayStartMin),
        height: heightOf(appointment.start, appointment.end),
      }}
      title={`${appointment.start}–${appointment.end} · ${appointment.client.name} · ${appointment.services.map((s) => s.name).join(" + ")} · ${appointmentStatusLabel(appointment.status)}`}
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
      <p className="truncate text-muted-foreground">{appointment.services.map((s) => s.name).join(" + ")}</p>
    </button>
  );
}

function BreakCard({
  start,
  end,
  dayStartMin,
}: {
  start: string;
  end: string;
  dayStartMin: number;
}) {
  return (
    <div
      data-slot="break-band"
      style={{ top: topOf(start, dayStartMin), height: heightOf(start, end) }}
      title={`Almoço · ${start}–${end}`}
      className="absolute inset-x-1 flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-amber-300/70 bg-amber-50/60 px-2 py-1 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-500"
    >
      <Coffee className="size-3 shrink-0" />
      <span className="truncate">Almoço</span>
    </div>
  );
}

function BlockCard({
  block,
  dayStartMin,
}: {
  block: TimeBlock;
  dayStartMin: number;
}) {
  return (
    <div
      data-slot="time-block"
      style={{
        top: topOf(block.start, dayStartMin),
        height: heightOf(block.start, block.end),
      }}
      title={`Bloqueado${block.reason ? ` · ${block.reason}` : ""}`}
      className="absolute inset-x-1 flex items-center gap-1 overflow-hidden rounded-md border border-dashed bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_6px,transparent_6px,transparent_12px)] px-2 py-1 text-xs text-muted-foreground"
    >
      <Lock className="size-3 shrink-0" />
      <span className="truncate">Bloqueado{block.reason ? ` · ${block.reason}` : ""}</span>
    </div>
  );
}

interface ScheduleDayGridProps {
  date: string;
  businessStart: string;
  businessEnd: string;
  professionals: ProfessionalView[];
  appointments: AppointmentView[];
  blocks: TimeBlock[];
  onSelectAppointment?: (a: AppointmentView) => void;
  /** Clique num espaco vago da coluna cria um agendamento naquele profissional
   *  e horario. Ausente = grade so de leitura (sem permissao de criar). */
  onCreateAppointment?: (args: {
    professionalId: string;
    date: string;
    start: string;
  }) => void;
}

export function ScheduleDayGrid({
  date,
  businessStart,
  businessEnd,
  professionals,
  appointments,
  blocks,
  onSelectAppointment,
  onCreateAppointment,
}: ScheduleDayGridProps) {
  // Cancelados nao aparecem no grid operacional (ficam no historico/Agendamentos).
  const visible = appointments.filter((a) => a.status !== "canceled");
  const weekday = weekdayOf(date);
  const { startMin: dayStartMin, endMin: dayEndMin } = expandedBusinessWindow(
    businessStart,
    businessEnd,
  );
  const nowMin = currentMinutes();
  const showNow = date === todayISO() && nowMin >= dayStartMin && nowMin <= dayEndMin;
  const nowTop = (nowMin - dayStartMin) * PX_PER_MIN;
  const startHour = Math.floor(dayStartMin / 60);
  const endHour = Math.ceil(dayEndMin / 60);
  const timelineHeight = (dayEndMin - dayStartMin) * PX_PER_MIN;
  const gridHeight = timelineHeight + GRID_Y_PADDING * 2;
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );

  return (
    <div data-slot="schedule-grid" className="overflow-x-auto overflow-y-hidden rounded-lg border bg-card">
      <div className="flex min-w-max">
        {/* Eixo de horas */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card">
          <div className="h-10 border-b" />
          <div className="relative" style={{ height: gridHeight }}>
            {showNow ? (
              <div
                className="absolute right-1 z-20 rounded-full bg-destructive px-1.5 py-0.5 text-[0.65rem] font-medium leading-none tabular-nums text-destructive-foreground"
                style={{ top: GRID_Y_PADDING + nowTop, transform: "translateY(-50%)" }}
              >
                Agora
              </div>
            ) : null}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
                style={{ top: GRID_Y_PADDING + (h * 60 - dayStartMin) * PX_PER_MIN }}
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
          const working = prof.workingHours.find((w) => w.weekday === weekday);
          const lunch =
            working?.breakStart && working?.breakEnd
              ? { start: working.breakStart, end: working.breakEnd }
              : null;
          return (
            <div key={prof.id} className="w-64 shrink-0 border-r last:border-r-0 lg:w-56">
              <div className="flex h-10 items-center justify-center border-b px-2 text-sm font-medium">
                <span className="truncate">{prof.name}</span>
              </div>
              <div
                className={cn("relative", onCreateAppointment && "cursor-pointer")}
                style={{ height: gridHeight }}
                onClick={
                  onCreateAppointment
                    ? (event) => {
                        // So o espaco vazio da coluna (nao cards/almoco/bloqueio,
                        // que sao filhos e param aqui por serem !== currentTarget).
                        if (event.target !== event.currentTarget) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        const rawMin =
                          dayStartMin +
                          (event.clientY - rect.top - GRID_Y_PADDING) / PX_PER_MIN;
                        // Sempre parte do inicio da hora clicada; se ocupado,
                        // avanca 15 min ate achar um horario livre.
                        const hourStart = Math.max(
                          Math.floor(rawMin / 60) * 60,
                          dayStartMin,
                        );
                        const busy: [number, number][] = [
                          ...profAppts.map(
                            (a): [number, number] => [toMin(a.start), toMin(a.end)],
                          ),
                          ...profBlocks.map(
                            (b): [number, number] => [toMin(b.start), toMin(b.end)],
                          ),
                          ...(lunch
                            ? [[toMin(lunch.start), toMin(lunch.end)] as [number, number]]
                            : []),
                        ];
                        onCreateAppointment({
                          professionalId: prof.id,
                          date,
                          start: minToTime(firstFreeSlot(hourStart, busy, dayEndMin)),
                        });
                      }
                    : undefined
                }
              >
                {showNow ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-destructive"
                    style={{ top: GRID_Y_PADDING + nowTop }}
                  >
                    <span className="absolute -left-1 top-0 size-2 -translate-y-1/2 rounded-full bg-destructive" />
                  </div>
                ) : null}
                {hours.slice(1).map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                    style={{ top: GRID_Y_PADDING + (h * 60 - dayStartMin) * PX_PER_MIN }}
                  />
                ))}
                {lunch ? (
                  <BreakCard
                    start={lunch.start}
                    end={lunch.end}
                    dayStartMin={dayStartMin - GRID_Y_PADDING / PX_PER_MIN}
                  />
                ) : null}
                {profBlocks.map((b) => (
                  <BlockCard
                    key={b.id}
                    block={b}
                    dayStartMin={dayStartMin - GRID_Y_PADDING / PX_PER_MIN}
                  />
                ))}
                {profAppts.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    dayStartMin={dayStartMin - GRID_Y_PADDING / PX_PER_MIN}
                    onSelect={onSelectAppointment}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryAppointmentButton({
  appointment,
  compact = false,
}: {
  appointment: AppointmentView;
  compact?: boolean;
}) {
  return (
    <div
      title={`${appointment.start}–${appointment.end} · ${appointment.client.name} · ${appointment.services.map((s) => s.name).join(" + ")} · ${appointment.professional.name}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs",
        appointment.status === "completed" || appointment.status === "no_show"
          ? "text-muted-foreground"
          : "text-foreground",
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[appointment.status])} />
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {appointment.start}
      </span>
      <span className="truncate font-medium">{appointment.client.name}</span>
      {compact ? null : (
        <span className="hidden truncate text-muted-foreground sm:inline">
          · {appointment.professional.name}
        </span>
      )}
    </div>
  );
}

interface ScheduleWeekGridProps {
  days: string[];
  appointments: AppointmentView[];
  onSelectDay: (day: string) => void;
}

export function ScheduleWeekGrid({
  days,
  appointments,
  onSelectDay,
}: ScheduleWeekGridProps) {
  const visible = appointments.filter((a) => a.status !== "canceled");

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-lg border bg-card">
      <div className="grid min-w-[70rem] grid-cols-7 divide-x">
        {days.map((day) => {
          const dayAppointments = visible.filter((a) => a.date === day);
          const parsed = parseISO(day);
          const isToday = day === todayISO();
          return (
            <button
              type="button"
              key={day}
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-[28rem] w-full appearance-none flex-col rounded-none border-0 bg-transparent p-0 text-left align-top transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isToday && "bg-primary/5 ring-1 ring-inset ring-primary/30",
              )}
            >
              <div className="sticky top-0 z-10 border-b bg-card px-3 py-2">
                <p
                  className={cn(
                    "text-xs font-medium uppercase text-muted-foreground",
                    isToday && "text-primary",
                  )}
                >
                  {format(parsed, "EEE", { locale: ptBR })}
                </p>
                <p
                  className={cn(
                    "mt-1 flex size-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(parsed, "d")}
                </p>
              </div>
              <div className="space-y-1 p-2">
                {dayAppointments.length > 0 ? (
                  dayAppointments.map((appointment) => (
                    <SummaryAppointmentButton
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-2 text-xs text-muted-foreground">
                    Sem agendamentos
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ScheduleMonthGridProps {
  monthDate: string;
  days: string[];
  appointments: AppointmentView[];
  onSelectDay: (day: string) => void;
}

export function ScheduleMonthGrid({
  monthDate,
  days,
  appointments,
  onSelectDay,
}: ScheduleMonthGridProps) {
  const visible = appointments.filter((a) => a.status !== "canceled");
  const currentMonth = parseISO(monthDate);

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-lg border bg-card">
      <div className="min-w-[70rem]">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const parsed = parseISO(day);
            const dayAppointments = visible.filter((a) => a.date === day);
            const shown = dayAppointments.slice(0, 3);
            const overflow = dayAppointments.length - shown.length;
            const isToday = day === todayISO();

            return (
              <button
                type="button"
                key={day}
                onClick={() => onSelectDay(day)}
                className={cn(
                  "flex min-h-32 w-full appearance-none flex-col items-stretch justify-start rounded-none border-0 border-b border-r bg-transparent p-2 text-left align-top transition-colors last:border-r-0 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  !isSameMonth(parsed, currentMonth) &&
                    "bg-muted/20 text-muted-foreground",
                  isToday && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(parsed, "d")}
                  </span>
                  {dayAppointments.length > 0 ? (
                    <span className="text-[0.7rem] text-muted-foreground">
                      {dayAppointments.length}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {shown.map((appointment) => (
                    <SummaryAppointmentButton
                      key={appointment.id}
                      appointment={appointment}
                      compact
                    />
                  ))}
                  {overflow > 0 ? (
                    <p className="px-1.5 pt-1 text-xs text-muted-foreground">
                      +{overflow} mais
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
