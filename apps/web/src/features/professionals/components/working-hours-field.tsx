"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FieldShell } from "@/components/form/field-shell";

interface WorkingHour {
  weekday: number;
  start: string;
  end: string;
}

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

interface WorkingHoursFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  disabled?: boolean;
}

/**
 * Disponibilidade por dia: marca os dias trabalhados e define inicio/fim.
 * O valor do campo e um array de { weekday, start, end }.
 */
export function WorkingHoursField<T extends FieldValues>({
  name,
  label = "Disponibilidade",
  disabled,
}: WorkingHoursFieldProps<T>) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hours = (field.value as WorkingHour[] | undefined) ?? [];
        const byDay = new Map(hours.map((h) => [h.weekday, h]));

        const setDay = (weekday: number, patch: Partial<WorkingHour>) =>
          field.onChange(
            hours.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)),
          );

        const toggle = (weekday: number, on: boolean) => {
          if (on) {
            field.onChange(
              [...hours, { weekday, start: "09:00", end: "18:00" }].sort(
                (a, b) => a.weekday - b.weekday,
              ),
            );
          } else {
            field.onChange(hours.filter((h) => h.weekday !== weekday));
          }
        };

        return (
          <FieldShell
            label={label}
            error={fieldState.error?.message}
            hint="Marque os dias e defina os horários de atendimento."
          >
            <div className="space-y-1.5 rounded-md border p-3">
              {WEEKDAYS.map((d) => {
                const entry = byDay.get(d.value);
                const on = Boolean(entry);
                return (
                  <div key={d.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(c) => toggle(d.value, Boolean(c))}
                      disabled={disabled}
                    />
                    <span className="w-20 shrink-0 text-sm">{d.label}</span>
                    {on && entry ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="time"
                          value={entry.start}
                          onChange={(e) =>
                            setDay(d.value, { start: e.target.value })
                          }
                          disabled={disabled}
                          className="h-8 w-28"
                        />
                        <span className="text-xs text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={entry.end}
                          onChange={(e) =>
                            setDay(d.value, { end: e.target.value })
                          }
                          disabled={disabled}
                          className="h-8 w-28"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Folga</span>
                    )}
                  </div>
                );
              })}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
