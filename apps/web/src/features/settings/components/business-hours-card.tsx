"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type {
  BusinessHoursDay,
  BusinessHoursShift,
  Unit,
  Weekday,
} from "@gestarahub/contracts";
import { checkSlotWithinBusinessHours } from "@gestarahub/core/scheduling";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useClassGroups } from "@/features/turmas";
import { useUnit, useUpdateUnit } from "../hooks/use-settings";

const WEEKDAYS: { weekday: Weekday; label: string }[] = [
  { weekday: 0, label: "Domingo" },
  { weekday: 1, label: "Segunda" },
  { weekday: 2, label: "Terça" },
  { weekday: 3, label: "Quarta" },
  { weekday: 4, label: "Quinta" },
  { weekday: 5, label: "Sexta" },
  { weekday: 6, label: "Sábado" },
];

interface NormalizedDay {
  weekday: Weekday;
  closed: boolean;
  shifts: BusinessHoursShift[];
}

const LAST_MINUTE = 23 * 60 + 55;
const MIN_SHIFT_MINUTES = 30;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Turno sugerido pelo "+ Turno": 1h depois do fim do ultimo turno, com ate 4h.
 * `null` quando nao sobra ao menos 30min ate 23:55 (o botao fica desabilitado).
 */
function suggestNextShift(shifts: BusinessHoursShift[]): BusinessHoursShift | null {
  const ends = shifts.filter((s) => s.end).map((s) => toMinutes(s.end));
  if (ends.length === 0) return { start: "14:00", end: "18:00" };
  const start = Math.max(...ends) + 60;
  if (start + MIN_SHIFT_MINUTES > LAST_MINUTE) return null;
  return { start: toTime(start), end: toTime(Math.min(start + 240, LAST_MINUTE)) };
}

function normalize(businessHours: BusinessHoursDay[]): NormalizedDay[] {
  return WEEKDAYS.map(({ weekday }) => {
    const found = businessHours.find((b) => b.weekday === weekday);
    if (!found) {
      return {
        weekday,
        closed: true,
        shifts: [{ start: "08:00", end: "18:00" }],
      };
    }
    const shifts: BusinessHoursShift[] =
      found.shifts && found.shifts.length > 0
        ? found.shifts.map((s) => ({ ...s }))
        : found.start && found.end
          ? [{ start: found.start, end: found.end }]
          : [{ start: "08:00", end: "18:00" }];
    return {
      weekday,
      closed: found.closed,
      shifts,
    };
  });
}

function BusinessHoursEditor({ unit }: { unit: Unit }) {
  const updateUnit = useUpdateUnit();
  const pending = updateUnit.isPending;
  // Turmas ativas: o novo expediente nao pode deixar aulas "orfas" sem aviso.
  const { data: activeGroups } = useClassGroups({ status: "active" });
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const [days, setDays] = useState<NormalizedDay[]>(() =>
    normalize(unit.businessHours),
  );
  const [dayErrors, setDayErrors] = useState<Partial<Record<Weekday, string>>>({});
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  function clearError(weekday?: Weekday) {
    if (weekday !== undefined) {
      setDayErrors((prev) => {
        if (!prev[weekday]) return prev;
        const copy = { ...prev };
        delete copy[weekday];
        return copy;
      });
      setInvalidFields((prev) => {
        const prefix = `${weekday}-`;
        const hasKey = Object.keys(prev).some((k) => k.startsWith(prefix));
        if (!hasKey) return prev;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(prefix)) delete next[k];
        }
        return next;
      });
    } else {
      setDayErrors({});
      setInvalidFields({});
    }
  }

  function toggleOpen(weekday: Weekday, open: boolean) {
    clearError(weekday);
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const shifts =
          d.shifts.length > 0 ? d.shifts : [{ start: "08:00", end: "18:00" }];
        return {
          ...d,
          closed: !open,
          shifts,
        };
      }),
    );
  }

  function addShift(weekday: Weekday) {
    clearError(weekday);
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const next = suggestNextShift(d.shifts);
        if (!next) return d;
        return { ...d, shifts: [...d.shifts, next] };
      }),
    );
  }

  function removeShift(weekday: Weekday, index: number) {
    clearError(weekday);
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        if (d.shifts.length <= 1) return d;
        return {
          ...d,
          shifts: d.shifts.filter((_, i) => i !== index),
        };
      }),
    );
  }

  function updateShift(
    weekday: Weekday,
    index: number,
    field: "start" | "end",
    value: string,
  ) {
    clearError(weekday);
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const nextShifts = d.shifts.map((shift, i) =>
          i === index ? { ...shift, [field]: value } : shift,
        );
        return { ...d, shifts: nextShifts };
      }),
    );
  }

  function copyMondayToWeekdays() {
    clearError();
    const monday = days.find((d) => d.weekday === 1);
    if (!monday) return;
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday >= 2 && d.weekday <= 5) {
          return {
            ...d,
            closed: monday.closed,
            shifts: monday.shifts.map((s) => ({ ...s })),
          };
        }
        return d;
      }),
    );
    toast.success("Horários de segunda-feira copiados para terça a sexta.");
  }

  async function save() {
    const nextErrors: Partial<Record<Weekday, string>> = {};
    const nextInvalidFields: Record<string, boolean> = {};
    let firstInvalidId: string | null = null;

    for (const day of days) {
      if (day.closed) continue;
      if (day.shifts.length === 0) {
        nextErrors[day.weekday] = "Configure pelo menos um turno de funcionamento.";
        continue;
      }
      let hasInvalidTime = false;
      for (let i = 0; i < day.shifts.length; i++) {
        const s = day.shifts[i];
        if (!s.start) {
          nextErrors[day.weekday] = "Preencha os horários de início e fim.";
          nextInvalidFields[`${day.weekday}-${i}-start`] = true;
          if (!firstInvalidId) firstInvalidId = `time-input-${day.weekday}-${i}-start`;
          hasInvalidTime = true;
        }
        if (!s.end) {
          nextErrors[day.weekday] = "Preencha os horários de início e fim.";
          nextInvalidFields[`${day.weekday}-${i}-end`] = true;
          if (!firstInvalidId) firstInvalidId = `time-input-${day.weekday}-${i}-end`;
          hasInvalidTime = true;
        }
        if (s.start && s.end && s.start >= s.end) {
          nextErrors[day.weekday] = "O horário de início deve ser anterior ao de fim.";
          nextInvalidFields[`${day.weekday}-${i}-start`] = true;
          nextInvalidFields[`${day.weekday}-${i}-end`] = true;
          if (!firstInvalidId) firstInvalidId = `time-input-${day.weekday}-${i}-end`;
          hasInvalidTime = true;
        }
      }
      if (hasInvalidTime) continue;

      const sortedWithIndex = day.shifts
        .map((s, idx) => ({ ...s, originalIndex: idx }))
        .sort((a, b) => a.start.localeCompare(b.start));

      for (let i = 0; i < sortedWithIndex.length - 1; i++) {
        const curr = sortedWithIndex[i];
        const next = sortedWithIndex[i + 1];
        if (curr.end > next.start) {
          nextErrors[day.weekday] = "Os turnos não podem se sobrepor.";
          nextInvalidFields[`${day.weekday}-${curr.originalIndex}-end`] = true;
          nextInvalidFields[`${day.weekday}-${next.originalIndex}-start`] = true;
          if (!firstInvalidId) {
            firstInvalidId = `time-input-${day.weekday}-${next.originalIndex}-start`;
          }
          break;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setDayErrors(nextErrors);
      setInvalidFields(nextInvalidFields);
      if (firstInvalidId) {
        const el = document.getElementById(firstInvalidId);
        if (el) {
          el.focus();
        }
      }
      return;
    }
    setDayErrors({});
    setInvalidFields({});

    const businessHours: BusinessHoursDay[] = days.map((d) => {
      if (d.closed) {
        return { weekday: d.weekday, closed: true, shifts: [] };
      }
      const sorted = [...d.shifts].sort((a, b) => a.start.localeCompare(b.start));
      return {
        weekday: d.weekday,
        closed: false,
        start: sorted[0].start,
        end: sorted[sorted.length - 1].end,
        shifts: sorted,
      };
    });

    const outside = (activeGroups ?? []).flatMap((g) =>
      g.meetingSlots
        .filter((slot) => !checkSlotWithinBusinessHours(slot.weekday, slot.start, slot.end, businessHours).valid)
        .map((slot) => `${g.name} (${WEEKDAYS[slot.weekday].label} ${slot.start})`),
    );
    if (outside.length > 0) {
      const ok = await confirmAction({
        title: "Há aulas fora do novo horário",
        description: (
          <>
            Estas aulas ficam fora do expediente e continuarão no calendário até você
            ajustar as turmas: <strong className="text-foreground">{outside.join(", ")}</strong>.
          </>
        ),
        confirmLabel: "Salvar mesmo assim",
      });
      if (!ok) return;
    }

    try {
      await updateUnit.mutateAsync({ businessHours });
      toast.success("Horários de funcionamento salvos.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar os horários."));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyMondayToWeekdays}
          disabled={pending}
          className="text-xs"
        >
          <Copy className="mr-1.5 size-3.5" />
          Copiar Segunda para Ter–Sex
        </Button>
      </div>

      <div className="divide-y rounded-lg border bg-card">
        {days.map((day) => {
          const label = WEEKDAYS.find((w) => w.weekday === day.weekday)!.label;
          const dayError = dayErrors[day.weekday];
          const noRoom = suggestNextShift(day.shifts) === null;
          return (
            <div
              key={day.weekday}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2"
            >
              <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2.5">
                <Switch
                  checked={!day.closed}
                  disabled={pending}
                  aria-label={`${label} aberto`}
                  onCheckedChange={(open) => toggleOpen(day.weekday, open)}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    day.closed && "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </label>

              {day.closed ? (
                <span className="flex h-8 items-center text-sm text-muted-foreground">
                  Fechado
                </span>
              ) : (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 max-sm:basis-full">
                  {day.shifts.map((shift, idx) => {
                    const isStartInvalid = Boolean(
                      invalidFields[`${day.weekday}-${idx}-start`],
                    );
                    const isEndInvalid = Boolean(
                      invalidFields[`${day.weekday}-${idx}-end`],
                    );
                    const invalid = isStartInvalid || isEndInvalid;
                    return (
                      // Cada turno e um bloco proprio (inicio, fim e remover juntos).
                      <div
                        key={idx}
                        role="group"
                        aria-label={`${label} turno ${idx + 1}`}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border bg-muted/50 p-1",
                          invalid && "border-destructive/60 bg-destructive/5",
                        )}
                      >
                        <Input
                          id={`time-input-${day.weekday}-${idx}-start`}
                          type="time"
                          step={300}
                          value={shift.start}
                          disabled={pending}
                          aria-label={`${label} turno ${idx + 1} início`}
                          aria-invalid={isStartInvalid}
                          className={cn(
                            "h-7 w-[5.75rem] bg-background px-1.5 shadow-none",
                            isStartInvalid &&
                              "border-destructive focus-visible:ring-destructive/40",
                          )}
                          onChange={(e) =>
                            updateShift(day.weekday, idx, "start", e.target.value)
                          }
                        />
                        <span className="px-0.5 text-xs text-muted-foreground">até</span>
                        <Input
                          id={`time-input-${day.weekday}-${idx}-end`}
                          type="time"
                          step={300}
                          value={shift.end}
                          disabled={pending}
                          aria-label={`${label} turno ${idx + 1} fim`}
                          aria-invalid={isEndInvalid}
                          className={cn(
                            "h-7 w-[5.75rem] bg-background px-1.5 shadow-none",
                            isEndInvalid &&
                              "border-destructive focus-visible:ring-destructive/40",
                          )}
                          onChange={(e) =>
                            updateShift(day.weekday, idx, "end", e.target.value)
                          }
                        />
                        {day.shifts.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={pending}
                            aria-label={`Remover turno ${idx + 1} de ${label}`}
                            onClick={() => removeShift(day.weekday, idx)}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  <span title={noRoom ? "Sem espaço depois do último turno" : undefined}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending || noRoom}
                      aria-label={`Adicionar turno em ${label}`}
                      onClick={() => addShift(day.weekday)}
                      className="h-8 px-2 text-xs text-primary hover:text-primary"
                    >
                      <Plus className="size-3.5" />
                      Turno
                    </Button>
                  </span>
                </div>
              )}

              {dayError ? (
                <p className="basis-full pl-[8.5rem] text-xs font-medium text-destructive max-sm:pl-0">
                  {dayError}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {confirmDialog}
      <div className="flex justify-end pt-1">
        <Button onClick={save} disabled={pending}>
          {pending ? "Salvando..." : "Salvar horários"}
        </Button>
      </div>
    </div>
  );
}

export function BusinessHoursForm() {
  const unitQuery = useUnit();

  if (unitQuery.isPending || !unitQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <BusinessHoursEditor unit={unitQuery.data} />;
}
