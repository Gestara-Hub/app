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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FieldShell } from "@/components/form/field-shell";

interface WorkingHour {
  weekday: number;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

const WEEKDAYS: { value: number; short: string; label: string }[] = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" },
];

interface Schedule {
  start: string;
  end: string;
  lunch: boolean;
  breakStart: string;
  breakEnd: string;
}

// Estado inicial "limpo": sem horario. So e preenchido quando o usuario ativa
// um dia (ver ensureTimes) — assim o cadastro novo abre sem nada definido.
const DEFAULT_SCHEDULE: Schedule = {
  start: "",
  end: "",
  lunch: false,
  breakStart: "12:00",
  breakEnd: "13:00",
};

/** Preenche o horario padrao quando ainda vazio (ao ativar um dia). */
function ensureTimes(s: Schedule): Schedule {
  return { ...s, start: s.start || "09:00", end: s.end || "18:00" };
}

function toSchedule(h: WorkingHour): Schedule {
  return {
    start: h.start,
    end: h.end,
    lunch: Boolean(h.breakStart && h.breakEnd),
    breakStart: h.breakStart ?? "12:00",
    breakEnd: h.breakEnd ?? "13:00",
  };
}

function toWorkingHour(weekday: number, s: Schedule): WorkingHour {
  return {
    weekday,
    start: s.start,
    end: s.end,
    ...(s.lunch ? { breakStart: s.breakStart, breakEnd: s.breakEnd } : {}),
  };
}

/** Horario "representativo" para o modo unico: 1o dia + o primeiro almoco achado. */
function deriveUniform(hours: WorkingHour[] | undefined): Schedule {
  const first = hours?.[0];
  if (!first) return DEFAULT_SCHEDULE;
  const withBreak = hours?.find((h) => h.breakStart && h.breakEnd);
  return {
    start: first.start,
    end: first.end,
    lunch: Boolean(withBreak),
    breakStart: withBreak?.breakStart ?? "12:00",
    breakEnd: withBreak?.breakEnd ?? "13:00",
  };
}

/** Dias ativos com horario ou almoco diferentes entre si — exige o editor por dia. */
function isHeterogeneous(hours: WorkingHour[] | undefined): boolean {
  if (!hours || hours.length <= 1) return false;
  const key = (h: WorkingHour) =>
    `${h.start}|${h.end}|${h.breakStart ?? ""}|${h.breakEnd ?? ""}`;
  const first = key(hours[0]);
  return hours.some((h) => key(h) !== first);
}

const byWeekday = (list: WorkingHour[]) =>
  [...list].sort((a, b) => a.weekday - b.weekday);

function TimeInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  className = "w-28",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Input
      type="time"
      step={300}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("h-8", className)}
    />
  );
}

interface WorkingHoursFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  disabled?: boolean;
}

/**
 * Disponibilidade com divulgacao progressiva: por padrao um unico horario (+
 * almoco opcional) aplicado a todos os dias marcados (chips). Ligando
 * "Personalizar horario por dia", cada dia ganha o proprio horario e almoco.
 *
 * Valor do campo (em ambos os modos): array de WorkingHours
 * `{ weekday, start, end, breakStart?, breakEnd? }` — o modelo/motor ja tratam
 * horario e intervalo por dia. Se o valor inicial ja for heterogeneo (ex.: sabado
 * diferente), abre direto no modo por dia para nao achatar os dados.
 */
export function WorkingHoursField<T extends FieldValues>({
  name,
  label = "Disponibilidade",
  disabled,
}: WorkingHoursFieldProps<T>) {
  const { control, getValues } = useFormContext<T>();
  const initial = getValues(name) as WorkingHour[] | undefined;
  const [perDay, setPerDay] = useState<boolean>(() => isHeterogeneous(initial));
  // Modelo do modo unico: horario base aplicado a todo dia marcado. Mantido em
  // estado para sobreviver a desmarcar/marcar dias (o campo pode ficar vazio).
  const [uniform, setUniform] = useState<Schedule>(() => deriveUniform(initial));

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hours = (field.value as WorkingHour[] | undefined) ?? [];
        const activeDays = new Set(hours.map((h) => h.weekday));
        const byDay = new Map(hours.map((h) => [h.weekday, h] as const));

        // ---- Modo unico -------------------------------------------------
        const commitUniform = (next: Schedule, days: Set<number>) => {
          // Com dias marcados, garante horario valido; sem dias, mantem vazio.
          const filled = days.size > 0 ? ensureTimes(next) : next;
          setUniform(filled);
          field.onChange(
            [...days].sort((a, b) => a - b).map((w) => toWorkingHour(w, filled)),
          );
        };
        const patchUniform = (patch: Partial<Schedule>) =>
          commitUniform({ ...uniform, ...patch }, activeDays);
        const toggleUniformDay = (weekday: number) => {
          const next = new Set(activeDays);
          if (next.has(weekday)) next.delete(weekday);
          else next.add(weekday);
          commitUniform(uniform, next);
        };

        // ---- Modo por dia -----------------------------------------------
        const setDayActive = (weekday: number, on: boolean) => {
          if (on) {
            const base =
              byDay.get(weekday) ?? toWorkingHour(weekday, ensureTimes(uniform));
            field.onChange(
              byWeekday([...hours.filter((h) => h.weekday !== weekday), base]),
            );
          } else {
            field.onChange(hours.filter((h) => h.weekday !== weekday));
          }
        };
        const patchDay = (weekday: number, patch: Partial<Schedule>) => {
          const current = byDay.get(weekday);
          if (!current) return;
          const merged = { ...toSchedule(current), ...patch };
          const nextEntry = toWorkingHour(weekday, merged);
          field.onChange(
            hours.map((h) => (h.weekday === weekday ? nextEntry : h)),
          );
        };

        // ---- Alternancia de modo ----------------------------------------
        const setPerDayMode = (on: boolean) => {
          if (on) {
            setPerDay(true);
            return;
          }
          // Voltar ao horario unico = unificar os dias marcados num so horario.
          const uni = deriveUniform(hours);
          setUniform(uni);
          setPerDay(false);
          field.onChange(
            [...activeDays]
              .sort((a, b) => a - b)
              .map((w) => toWorkingHour(w, uni)),
          );
        };

        return (
          <FieldShell
            label={label}
            error={fieldState.error?.message}
            hint={
              perDay
                ? "Cada dia marcado tem o próprio horário e almoço."
                : "O horário vale para todos os dias marcados."
            }
          >
            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={perDay}
                  onCheckedChange={setPerDayMode}
                  disabled={disabled}
                  aria-label="Personalizar horário por dia"
                />
                <span className="text-muted-foreground">
                  Personalizar horário por dia
                </span>
              </label>

              {perDay ? (
                <div className="divide-y divide-border overflow-hidden rounded-md border">
                  {WEEKDAYS.map((d) => {
                    const on = activeDays.has(d.value);
                    const entry = byDay.get(d.value);
                    const s = entry ? toSchedule(entry) : null;
                    return (
                      <div key={d.value} className="px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-8 shrink-0 font-medium">
                            {d.short}
                          </span>
                          <Switch
                            checked={on}
                            onCheckedChange={(v) => setDayActive(d.value, v)}
                            disabled={disabled}
                            aria-label={`${d.label} — atende`}
                          />
                          {on && s ? (
                            <>
                              <TimeInput
                                value={s.start}
                                onChange={(v) => patchDay(d.value, { start: v })}
                                disabled={disabled}
                                ariaLabel={`${d.label}: início do atendimento`}
                                className="w-28"
                              />
                              <span className="text-muted-foreground">às</span>
                              <TimeInput
                                value={s.end}
                                onChange={(v) => patchDay(d.value, { end: v })}
                                disabled={disabled}
                                ariaLabel={`${d.label}: fim do atendimento`}
                                className="w-28"
                              />
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Não atende
                            </span>
                          )}
                        </div>

                        {on && s ? (
                          <div className="mt-2 flex items-center gap-2 pl-10 text-muted-foreground">
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={s.lunch}
                                onCheckedChange={(c) =>
                                  patchDay(d.value, { lunch: Boolean(c) })
                                }
                                disabled={disabled}
                              />
                              Almoço
                            </label>
                            {s.lunch ? (
                              <>
                                <TimeInput
                                  value={s.breakStart}
                                  onChange={(v) =>
                                    patchDay(d.value, { breakStart: v })
                                  }
                                  disabled={disabled}
                                  ariaLabel={`${d.label}: início do almoço`}
                                  className="w-28"
                                />
                                <span>às</span>
                                <TimeInput
                                  value={s.breakEnd}
                                  onChange={(v) =>
                                    patchDay(d.value, { breakEnd: v })
                                  }
                                  disabled={disabled}
                                  ariaLabel={`${d.label}: fim do almoço`}
                                  className="w-28"
                                />
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Atende das</span>
                    <TimeInput
                      value={uniform.start}
                      onChange={(v) => patchUniform({ start: v })}
                      disabled={disabled}
                      ariaLabel="Início do atendimento"
                    />
                    <span className="text-muted-foreground">às</span>
                    <TimeInput
                      value={uniform.end}
                      onChange={(v) => patchUniform({ end: v })}
                      disabled={disabled}
                      ariaLabel="Fim do atendimento"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-1.5 text-muted-foreground">
                      <Checkbox
                        checked={uniform.lunch}
                        onCheckedChange={(c) =>
                          patchUniform({ lunch: Boolean(c) })
                        }
                        disabled={disabled}
                      />
                      Almoço
                    </label>
                    {uniform.lunch ? (
                      <>
                        <TimeInput
                          value={uniform.breakStart}
                          onChange={(v) => patchUniform({ breakStart: v })}
                          disabled={disabled}
                          ariaLabel="Início do almoço"
                        />
                        <span className="text-muted-foreground">às</span>
                        <TimeInput
                          value={uniform.breakEnd}
                          onChange={(v) => patchUniform({ breakEnd: v })}
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
                        const on = activeDays.has(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleUniformDay(d.value)}
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
                </>
              )}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
