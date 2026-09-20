"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
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
        const lastShift = d.shifts[d.shifts.length - 1];
        let defaultStart = "14:00";
        let defaultEnd = "18:00";
        if (lastShift) {
          const [h, m] = lastShift.end.split(":").map(Number);
          const nextStartH = Math.min(22, Math.max(0, h + 1));
          const nextEndH = Math.min(23, nextStartH + 4);
          defaultStart = `${String(nextStartH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
          defaultEnd = `${String(nextEndH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
        }
        return {
          ...d,
          shifts: [...d.shifts, { start: defaultStart, end: defaultEnd }],
        };
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
          return (
            <div
              key={day.weekday}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div
                className={cn(
                  "flex w-32 shrink-0 items-center justify-between",
                  day.closed ? "sm:pt-1" : "sm:pt-6",
                )}
              >
                <span className="text-sm font-medium">{label}</span>
                <Switch
                  checked={!day.closed}
                  disabled={pending}
                  aria-label={`${label} aberto`}
                  onCheckedChange={(open) => toggleOpen(day.weekday, open)}
                />
              </div>

              <div className="flex-1">
                {day.closed ? (
                  <span className="inline-block py-1 text-sm text-muted-foreground">
                    Fechado
                  </span>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="w-28">Início</span>
                      <span className="invisible text-sm select-none">às</span>
                      <span className="w-28">Fim</span>
                    </div>
                    {day.shifts.map((shift, idx) => {
                      const isStartInvalid = Boolean(
                        invalidFields[`${day.weekday}-${idx}-start`],
                      );
                      const isEndInvalid = Boolean(
                        invalidFields[`${day.weekday}-${idx}-end`],
                      );
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            id={`time-input-${day.weekday}-${idx}-start`}
                            type="time"
                            step={300}
                            value={shift.start}
                            disabled={pending}
                            aria-label={`${label} turno ${idx + 1} início`}
                            aria-invalid={isStartInvalid}
                            className={cn(
                              "w-28",
                              isStartInvalid &&
                                "border-destructive focus-visible:ring-destructive/40",
                            )}
                            onChange={(e) =>
                              updateShift(day.weekday, idx, "start", e.target.value)
                            }
                          />
                          <span className="text-sm text-muted-foreground">às</span>
                          <Input
                            id={`time-input-${day.weekday}-${idx}-end`}
                            type="time"
                            step={300}
                            value={shift.end}
                            disabled={pending}
                            aria-label={`${label} turno ${idx + 1} fim`}
                            aria-invalid={isEndInvalid}
                            className={cn(
                              "w-28",
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
                            size="icon-sm"
                            disabled={pending}
                            aria-label={`Remover turno ${idx + 1} de ${label}`}
                            onClick={() => removeShift(day.weekday, idx)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => addShift(day.weekday)}
                        className="h-7 px-2 text-xs text-primary hover:text-primary"
                      >
                        <Plus className="mr-1 size-3" />
                        Adicionar turno
                      </Button>
                    </div>

                    {dayError ? (
                      <p className="text-xs font-medium text-destructive pt-0.5">
                        {dayError}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
