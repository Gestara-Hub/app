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
import type { Unit } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";

export interface WorkingHour {
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

export interface Schedule {
  start: string;
  end: string;
  lunch: boolean;
  breakStart: string;
  breakEnd: string;
}

const DEFAULT_SCHEDULE: Schedule = {
  start: "09:00",
  end: "18:00",
  lunch: false,
  breakStart: "12:00",
  breakEnd: "13:00",
};

/**
 * Retorna os horários padrão ao criar um novo profissional:
 * Prioriza os dias abertos e horários configurados na unidade;
 * Se a unidade não tiver horários cadastrados, usa Segunda a Sexta das 09:00 às 18:00.
 */
export function getDefaultWorkingHours(unit?: Unit): WorkingHour[] {
  const openDays = (unit?.businessHours ?? []).filter(
    (d) => !d.closed && ((d.start && d.end) || (d.shifts && d.shifts.length > 0)),
  );
  if (openDays.length > 0) {
    return openDays.map((d) => ({
      weekday: d.weekday,
      start: d.start ?? d.shifts?.[0]?.start ?? "09:00",
      end: d.end ?? d.shifts?.[d.shifts.length - 1]?.end ?? "18:00",
    }));
  }
  return [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    start: "09:00",
    end: "18:00",
  }));
}

/** Preenche o horário padrão quando ainda vazio. */
function ensureTimes(s: Schedule): Schedule {
  return { ...s, start: s.start || "09:00", end: s.end || "18:00" };
}

function toSchedule(h: WorkingHour): Schedule {
  return {
    start: h.start || "09:00",
    end: h.end || "18:00",
    lunch: Boolean(h.breakStart && h.breakEnd),
    breakStart: h.breakStart ?? "12:00",
    breakEnd: h.breakEnd ?? "13:00",
  };
}

function toWorkingHour(weekday: number, s: Schedule): WorkingHour {
  return {
    weekday,
    start: s.start || "09:00",
    end: s.end || "18:00",
    ...(s.lunch ? { breakStart: s.breakStart, breakEnd: s.breakEnd } : {}),
  };
}

/** Horário "representativo" para o modo único: 1º dia + o primeiro almoço achado. */
function deriveUniform(hours: WorkingHour[] | undefined): Schedule {
  const first = hours?.[0];
  if (!first) return DEFAULT_SCHEDULE;
  const withBreak = hours?.find((h) => h.breakStart && h.breakEnd);
  return {
    start: first.start || "09:00",
    end: first.end || "18:00",
    lunch: Boolean(withBreak),
    breakStart: withBreak?.breakStart ?? "12:00",
    breakEnd: withBreak?.breakEnd ?? "13:00",
  };
}

/** Dias ativos com horário ou almoço diferentes entre si — exige o editor por dia. */
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
  borderless?: boolean;
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
  borderless = false,
}: WorkingHoursFieldProps<T>) {
  const isClasses = useModel() === "classes";
  const { control, getValues } = useFormContext<T>();
  const initial = getValues(name) as WorkingHour[] | undefined;
  const [perDay, setPerDay] = useState<boolean>(() => isHeterogeneous(initial));
  const [uniform, setUniform] = useState<Schedule>(() => deriveUniform(initial));

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hours = (field.value as WorkingHour[] | undefined) ?? [];
        const activeDays = new Set(hours.map((h) => h.weekday));
        const byDay = new Map(hours.map((h) => [h.weekday, h] as const));

        // Mantém o schedule uniforme sincronizado se os horários mudarem
        const commitUniform = (next: Schedule, days: Set<number>) => {
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

        // ---- Alternância de modo ----------------------------------------
        const setPerDayMode = (on: boolean) => {
          if (on) {
            setPerDay(true);
            return;
          }
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
          <FieldShell label={label} error={fieldState.error?.message}>
            <div
              className={cn(
                "space-y-4",
                !borderless &&
                  "rounded-xl border bg-card p-3.5 shadow-2xs sm:p-4",
              )}
            >
              {perDay ? (
                /* MODO AVANÇADO: HORÁRIOS POR DIA */
                <div className="space-y-3">
                  <div className="divide-y divide-border overflow-hidden rounded-lg border bg-background">
                    {WEEKDAYS.map((d) => {
                      const on = activeDays.has(d.value);
                      const entry = byDay.get(d.value);
                      const s = entry ? toSchedule(entry) : null;
                      return (
                        <div key={d.value} className="px-3 py-2.5 text-sm">
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
                                  onChange={(v) =>
                                    patchDay(d.value, { start: v })
                                  }
                                  disabled={disabled}
                                  ariaLabel={`${d.label}: início`}
                                />
                                <span className="text-muted-foreground">às</span>
                                <TimeInput
                                  value={s.end}
                                  onChange={(v) =>
                                    patchDay(d.value, { end: v })
                                  }
                                  disabled={disabled}
                                  ariaLabel={`${d.label}: término`}
                                />
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Não atende
                              </span>
                            )}
                          </div>

                          {on && s ? (
                            <div className="mt-2 flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                              <label className="flex cursor-pointer items-center gap-1.5">
                                <Checkbox
                                  checked={s.lunch}
                                  onCheckedChange={(c) =>
                                    patchDay(d.value, { lunch: Boolean(c) })
                                  }
                                  disabled={disabled}
                                />
                                {isClasses ? "Intervalo" : "Almoço"}
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
                                    className="w-24"
                                  />
                                  <span>às</span>
                                  <TimeInput
                                    value={s.breakEnd}
                                    onChange={(v) =>
                                      patchDay(d.value, { breakEnd: v })
                                    }
                                    disabled={disabled}
                                    ariaLabel={`${d.label}: término do almoço`}
                                    className="w-24"
                                  />
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t pt-3">
                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span className="text-sm font-medium text-foreground">
                        Personalizar horário por dia
                      </span>
                      <Switch
                        checked={perDay}
                        onCheckedChange={setPerDayMode}
                        disabled={disabled}
                        aria-label="Personalizar horário por dia"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* MODO UNIFICADO (PADRÃO): DIAS -> HORÁRIOS -> ALMOÇO */
                <div className="space-y-4">
                  {/* DIAS */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const on = activeDays.has(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleUniformDay(d.value)}
                          disabled={disabled}
                          aria-pressed={on}
                          title={`${d.label}: clique para ${on ? "desmarcar" : "marcar"}`}
                          className={cn(
                            "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all select-none disabled:opacity-50",
                            on
                              ? "border-primary bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/20"
                              : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <span>{d.short}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* HORÁRIOS */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {isClasses ? "Disponível das" : "Atende das"}
                    </span>
                    <TimeInput
                      value={uniform.start}
                      onChange={(v) => patchUniform({ start: v })}
                      disabled={disabled || activeDays.size === 0}
                      ariaLabel={
                        isClasses
                          ? "Início da disponibilidade"
                          : "Início do atendimento"
                      }
                    />
                    <span className="text-muted-foreground">às</span>
                    <TimeInput
                      value={uniform.end}
                      onChange={(v) => patchUniform({ end: v })}
                      disabled={disabled || activeDays.size === 0}
                      ariaLabel={
                        isClasses
                          ? "Fim da disponibilidade"
                          : "Fim do atendimento"
                      }
                    />
                  </div>

                  {/* ALMOÇO / INTERVALO */}
                  <div className="space-y-2">
                    <label
                      className={cn(
                        "inline-flex items-center gap-2 text-sm",
                        activeDays.size === 0
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer",
                      )}
                    >
                      <Checkbox
                        checked={uniform.lunch}
                        onCheckedChange={(c) =>
                          patchUniform({ lunch: Boolean(c) })
                        }
                        disabled={disabled || activeDays.size === 0}
                      />
                      <span className="text-foreground">
                        {isClasses
                          ? "Adicionar intervalo de descanso"
                          : "Adicionar horário de almoço"}
                      </span>
                    </label>

                    {uniform.lunch && activeDays.size > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 pl-6 text-sm text-muted-foreground">
                        <span>Das</span>
                        <TimeInput
                          value={uniform.breakStart}
                          onChange={(v) => patchUniform({ breakStart: v })}
                          disabled={disabled}
                          ariaLabel="Início do intervalo"
                        />
                        <span>às</span>
                        <TimeInput
                          value={uniform.breakEnd}
                          onChange={(v) => patchUniform({ breakEnd: v })}
                          disabled={disabled}
                          ariaLabel="Fim do intervalo"
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* PERSONALIZAR POR DIA */}
                  <div className="border-t pt-3">
                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span className="text-sm font-medium text-foreground">
                        Personalizar horários por dia
                      </span>
                      <Switch
                        checked={perDay}
                        onCheckedChange={setPerDayMode}
                        disabled={disabled}
                        aria-label="Personalizar horário por dia"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
