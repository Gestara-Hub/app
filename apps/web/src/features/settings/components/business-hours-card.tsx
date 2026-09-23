"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { UnsavedChangesStatus, useReportDirty } from "./unsaved-changes";

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

interface ShiftsValidation {
  message?: string;
  /** Campos invalidos, chave `${indice}-start` ou `${indice}-end`. */
  invalid: Set<string>;
}

/** Valida os turnos de um dia: preenchidos, inicio antes do fim e sem sobreposicao. */
function validateShifts(shifts: BusinessHoursShift[]): ShiftsValidation {
  const invalid = new Set<string>();
  if (shifts.length === 0) {
    return { message: "Configure pelo menos um turno de funcionamento.", invalid };
  }
  let message: string | undefined;
  shifts.forEach((s, i) => {
    if (!s.start) invalid.add(`${i}-start`);
    if (!s.end) invalid.add(`${i}-end`);
    if (!s.start || !s.end) {
      message ??= "Preencha os horários de início e fim.";
    } else if (s.start >= s.end) {
      invalid.add(`${i}-start`).add(`${i}-end`);
      message ??= "O horário de início deve ser anterior ao de fim.";
    }
  });
  if (message) return { message, invalid };

  const sorted = shifts
    .map((s, index) => ({ ...s, index }))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      invalid.add(`${sorted[i].index}-end`).add(`${sorted[i + 1].index}-start`);
      return { message: "Os turnos não podem se sobrepor.", invalid };
    }
  }
  return { invalid };
}

const sortShifts = (shifts: BusinessHoursShift[]) =>
  [...shifts].sort((a, b) => a.start.localeCompare(b.start));

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

/** Forma canonica do expediente para comparar rascunho x salvo (dia fechado ignora turnos). */
function hoursSignature(days: NormalizedDay[]): string {
  return days
    .map((d) =>
      d.closed
        ? `${d.weekday}:fechado`
        : `${d.weekday}:${sortShifts(d.shifts)
            .map((s) => `${s.start}-${s.end}`)
            .join(",")}`,
    )
    .join("|");
}

/**
 * Modal de edicao dos turnos de um dia. Os turnos podem ser aplicados a outros
 * dias de uma vez. "Aplicar" so altera o rascunho: quem grava e "Salvar horarios".
 */
function DayShiftsDialog({
  day,
  showErrors,
  onApply,
  onClose,
}: {
  day: NormalizedDay;
  /** Abriu por erro no salvar: ja mostra a validacao. */
  showErrors: boolean;
  onApply: (shifts: BusinessHoursShift[], alsoWeekdays: Weekday[]) => void;
  onClose: () => void;
}) {
  const label = WEEKDAYS[day.weekday].label;
  const [shifts, setShifts] = useState<BusinessHoursShift[]>(() =>
    day.shifts.map((s) => ({ ...s })),
  );
  const [validation, setValidation] = useState<ShiftsValidation>(() =>
    showErrors ? validateShifts(day.shifts) : { invalid: new Set() },
  );
  const [alsoWeekdays, setAlsoWeekdays] = useState<Set<Weekday>>(() => new Set());
  const noRoom = suggestNextShift(shifts) === null;

  const edit = (next: BusinessHoursShift[]) => {
    setShifts(next);
    setValidation({ invalid: new Set() });
  };

  function apply() {
    const result = validateShifts(shifts);
    if (result.message) {
      setValidation(result);
      const first = [...result.invalid][0];
      if (first) {
        const [idx, field] = first.split("-");
        document.getElementById(`shift-${idx}-${field}`)?.focus();
      }
      return;
    }
    onApply(sortShifts(shifts), [...alsoWeekdays]);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Horários de {label}</DialogTitle>
          <DialogDescription>Turnos em que a unidade funciona neste dia.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {shifts.map((shift, idx) => {
            const startInvalid = validation.invalid.has(`${idx}-start`);
            const endInvalid = validation.invalid.has(`${idx}-end`);
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground max-sm:hidden">
                  Turno {idx + 1}
                </span>
                <Input
                  id={`shift-${idx}-start`}
                  type="time"
                  step={300}
                  value={shift.start}
                  aria-label={`${label} turno ${idx + 1} início`}
                  aria-invalid={startInvalid}
                  className={cn("w-28 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1", startInvalid && "border-destructive")}
                  onChange={(e) =>
                    edit(shifts.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)))
                  }
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  id={`shift-${idx}-end`}
                  type="time"
                  step={300}
                  value={shift.end}
                  aria-label={`${label} turno ${idx + 1} fim`}
                  aria-invalid={endInvalid}
                  className={cn("w-28 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1", endInvalid && "border-destructive")}
                  onChange={(e) =>
                    edit(shifts.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)))
                  }
                />
                {shifts.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover turno ${idx + 1} de ${label}`}
                    onClick={() => edit(shifts.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
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
              disabled={noRoom}
              aria-label={`Adicionar turno em ${label}`}
              onClick={() => {
                const next = suggestNextShift(shifts);
                if (next) edit([...shifts, next]);
              }}
              className="px-2 text-primary hover:text-primary"
            >
              <Plus className="size-4" />
              Adicionar turno
            </Button>
          </span>

          {validation.message ? (
            <p className="text-xs font-medium text-destructive">{validation.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Aplicar também a</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => {
              // O dia em edicao aparece marcado e travado: os turnos ja valem para ele.
              const isCurrent = w.weekday === day.weekday;
              const on = isCurrent || alsoWeekdays.has(w.weekday);
              return (
                <button
                  key={w.weekday}
                  type="button"
                  aria-pressed={on}
                  disabled={isCurrent}
                  title={isCurrent ? `${label} é o dia em edição` : undefined}
                  onClick={() =>
                    setAlsoWeekdays((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(w.weekday);
                      else next.add(w.weekday);
                      return next;
                    })
                  }
                  className={cn(
                    "h-8 cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-60",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={apply}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BusinessHoursEditor({
  unit,
  onDirtyChange,
}: {
  unit: Unit;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const updateUnit = useUpdateUnit();
  const pending = updateUnit.isPending;
  // Turmas ativas: o novo expediente nao pode deixar aulas "orfas" sem aviso.
  // Salvar espera as turmas carregarem: senao o aviso de aulas fora do novo
  // horario seria pulado (lista vazia) e o dia fecharia sem avisar.
  const { data: activeGroups, isPending: groupsPending } = useClassGroups({ status: "active" });
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const [days, setDays] = useState<NormalizedDay[]>(() =>
    normalize(unit.businessHours),
  );
  // Sujo = rascunho diferente do expediente salvo na unidade
  const dirty = useMemo(
    () => hoursSignature(days) !== hoursSignature(normalize(unit.businessHours)),
    [days, unit.businessHours],
  );
  useReportDirty(dirty, onDirtyChange);
  const [dayErrors, setDayErrors] = useState<Partial<Record<Weekday, string>>>({});
  // Horario ainda nao definido (1o passo do onboarding): a lista pulsa ate o
  // usuario clicar nela.
  const [highlight, setHighlight] = useState(
    () => !unit.businessHours.some((day) => !day.closed),
  );
  const [editing, setEditing] = useState<{ weekday: Weekday; showErrors: boolean } | null>(
    null,
  );

  function clearError(weekdays: Weekday[]) {
    setDayErrors((prev) => {
      if (!weekdays.some((w) => prev[w])) return prev;
      const next = { ...prev };
      for (const w of weekdays) delete next[w];
      return next;
    });
  }

  function toggleOpen(weekday: Weekday, open: boolean) {
    clearError([weekday]);
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const shifts =
          d.shifts.length > 0 ? d.shifts : [{ start: "08:00", end: "18:00" }];
        return { ...d, closed: !open, shifts };
      }),
    );
  }

  function applyShifts(weekday: Weekday, shifts: BusinessHoursShift[], alsoWeekdays: Weekday[]) {
    const targets = [weekday, ...alsoWeekdays];
    clearError(targets);
    setDays((prev) =>
      prev.map((d) =>
        targets.includes(d.weekday)
          ? { ...d, closed: false, shifts: shifts.map((s) => ({ ...s })) }
          : d,
      ),
    );
    setEditing(null);
    if (alsoWeekdays.length > 0) {
      const names = alsoWeekdays
        .sort((a, b) => a - b)
        .map((w) => WEEKDAYS[w].label)
        .join(", ");
      toast.success(`Horários aplicados também a ${names}.`);
    }
  }

  async function save() {
    const nextErrors: Partial<Record<Weekday, string>> = {};
    for (const day of days) {
      if (day.closed) continue;
      const { message } = validateShifts(day.shifts);
      if (message) nextErrors[day.weekday] = message;
    }
    const firstError = days.find((d) => nextErrors[d.weekday]);
    if (firstError) {
      setDayErrors(nextErrors);
      setEditing({ weekday: firstError.weekday, showErrors: true });
      return;
    }
    setDayErrors({});

    const businessHours: BusinessHoursDay[] = days.map((d) => {
      if (d.closed) {
        return { weekday: d.weekday, closed: true, shifts: [] };
      }
      const sorted = sortShifts(d.shifts);
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

  const editingDay = editing ? days.find((d) => d.weekday === editing.weekday) : undefined;

  return (
    <div className="space-y-4">
      <div
        onPointerDownCapture={() => setHighlight(false)}
        className={cn(
          "divide-y rounded-lg border bg-card transition-colors",
          highlight && "border-primary/60 motion-safe:animate-attention-ring",
        )}
      >
        {days.map((day) => {
          const label = WEEKDAYS[day.weekday].label;
          const dayError = dayErrors[day.weekday];
          return (
            <div
              key={day.weekday}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
            >
              <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2.5">
                <Switch
                  checked={!day.closed}
                  disabled={pending}
                  aria-label={`${label} aberto`}
                  onCheckedChange={(open) => toggleOpen(day.weekday, open)}
                />
                <span
                  className={cn("text-sm font-medium", day.closed && "text-muted-foreground")}
                >
                  {label}
                </span>
              </label>

              <div
                data-testid={`hours-summary-${day.weekday}`}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 max-sm:order-last max-sm:basis-full"
              >
                {day.closed ? (
                  <span className="text-sm text-muted-foreground">Fechado</span>
                ) : (
                  sortShifts(day.shifts).map((shift, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border bg-muted/50 px-2 py-0.5 text-sm tabular-nums"
                    >
                      {shift.start}–{shift.end}
                    </span>
                  ))
                )}
                {dayError ? (
                  <span className="text-xs font-medium text-destructive">{dayError}</span>
                ) : null}
              </div>

              {!day.closed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Editar horários de ${label}`}
                  onClick={() => setEditing({ weekday: day.weekday, showErrors: false })}
                  className="ml-auto h-8 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {editingDay && editing ? (
        <DayShiftsDialog
          key={editing.weekday}
          day={editingDay}
          showErrors={editing.showErrors}
          onApply={(shifts, also) => applyShifts(editingDay.weekday, shifts, also)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {confirmDialog}
      <div className="flex items-center justify-between gap-3 pt-1">
        <UnsavedChangesStatus dirty={dirty} />
        <Button onClick={save} disabled={pending || groupsPending}>
          {pending ? "Salvando..." : "Salvar horários"}
        </Button>
      </div>
    </div>
  );
}

export function BusinessHoursForm({
  onDirtyChange,
}: {
  /** Avisa as abas quando ha alteracoes nao salvas. */
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
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

  return <BusinessHoursEditor unit={unitQuery.data} onDirtyChange={onDirtyChange} />;
}
