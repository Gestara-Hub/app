"use client";

import { useState } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldShell } from "@/components/form/field-shell";

interface WorkingHour {
  weekday: number;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

const WEEKDAYS: { value: number; short: string }[] = [
  { value: 0, short: "Dom" },
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
];

interface Schedule {
  start: string;
  end: string;
  lunch: boolean;
  breakStart: string;
  breakEnd: string;
}

function deriveSchedule(hours: WorkingHour[] | undefined): Schedule {
  const withBreak = hours?.find((h) => h.breakStart && h.breakEnd);
  const first = hours?.[0];
  return {
    start: first?.start ?? "09:00",
    end: first?.end ?? "18:00",
    lunch: Boolean(withBreak),
    breakStart: withBreak?.breakStart ?? "12:00",
    breakEnd: withBreak?.breakEnd ?? "13:00",
  };
}

function TimeInput({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <Input
      type="time"
      step={300}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-8 w-28"
    />
  );
}

interface WorkingHoursFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  disabled?: boolean;
}

/**
 * Disponibilidade simples: um horario de atendimento + almoco (opcional)
 * aplicado a todos os dias marcados; os dias sao chips. Valor do campo: array
 * de { weekday, start, end, breakStart?, breakEnd? } — o mesmo horario para
 * cada dia marcado. (Variacao por dia — horario ou almoco — fica para depois; o
 * modelo ja suporta `breakStart/breakEnd` por dia.)
 */
export function WorkingHoursField<T extends FieldValues>({
  name,
  label = "Disponibilidade",
  disabled,
}: WorkingHoursFieldProps<T>) {
  const { control, getValues } = useFormContext<T>();
  const [sched, setSched] = useState<Schedule>(() =>
    deriveSchedule(getValues(name) as WorkingHour[] | undefined),
  );

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hours = (field.value as WorkingHour[] | undefined) ?? [];
        const days = new Set(hours.map((h) => h.weekday));

        const write = (nextDays: Set<number>, s: Schedule) => {
          field.onChange(
            [...nextDays]
              .sort((a, b) => a - b)
              .map((weekday) => ({
                weekday,
                start: s.start,
                end: s.end,
                ...(s.lunch
                  ? { breakStart: s.breakStart, breakEnd: s.breakEnd }
                  : {}),
              })),
          );
        };

        const patchSchedule = (patch: Partial<Schedule>) => {
          const next = { ...sched, ...patch };
          setSched(next);
          write(days, next);
        };

        const toggleDay = (weekday: number) => {
          const next = new Set(days);
          if (next.has(weekday)) next.delete(weekday);
          else next.add(weekday);
          write(next, sched);
        };

        return (
          <FieldShell
            label={label}
            error={fieldState.error?.message}
            hint="O horário vale para todos os dias marcados."
          >
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Atende das</span>
                <TimeInput
                  value={sched.start}
                  onChange={(v) => patchSchedule({ start: v })}
                  disabled={disabled}
                  ariaLabel="Início do atendimento"
                />
                <span className="text-muted-foreground">às</span>
                <TimeInput
                  value={sched.end}
                  onChange={(v) => patchSchedule({ end: v })}
                  disabled={disabled}
                  ariaLabel="Fim do atendimento"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <Checkbox
                    checked={sched.lunch}
                    onCheckedChange={(c) => patchSchedule({ lunch: Boolean(c) })}
                    disabled={disabled}
                  />
                  Almoço
                </label>
                {sched.lunch ? (
                  <>
                    <TimeInput
                      value={sched.breakStart}
                      onChange={(v) => patchSchedule({ breakStart: v })}
                      disabled={disabled}
                      ariaLabel="Início do almoço"
                    />
                    <span className="text-muted-foreground">às</span>
                    <TimeInput
                      value={sched.breakEnd}
                      onChange={(v) => patchSchedule({ breakEnd: v })}
                      disabled={disabled}
                      ariaLabel="Fim do almoço"
                    />
                  </>
                ) : null}
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Dias de atendimento
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = days.has(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        disabled={disabled}
                        aria-pressed={on}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
