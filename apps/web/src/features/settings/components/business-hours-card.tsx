"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { BusinessHoursDay, Unit, Weekday } from "@gestarahub/contracts";
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

function normalize(businessHours: BusinessHoursDay[]): BusinessHoursDay[] {
  return WEEKDAYS.map(({ weekday }) => {
    const found = businessHours.find((b) => b.weekday === weekday);
    if (found) return { ...found };
    return { weekday, closed: true };
  });
}

function BusinessHoursEditor({ unit }: { unit: Unit }) {
  const updateUnit = useUpdateUnit();
  const pending = updateUnit.isPending;
  const [days, setDays] = useState<BusinessHoursDay[]>(() =>
    normalize(unit.businessHours),
  );
  const [error, setError] = useState<string | null>(null);

  function patch(weekday: Weekday, next: Partial<BusinessHoursDay>) {
    setError(null);
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...next } : d)),
    );
  }

  function toggleOpen(weekday: Weekday, open: boolean) {
    const current = days.find((d) => d.weekday === weekday);
    patch(weekday, {
      closed: !open,
      start: current?.start ?? "09:00",
      end: current?.end ?? "18:00",
    });
  }

  async function save() {
    const invalid = days.some(
      (d) => !d.closed && (!d.start || !d.end || d.start >= d.end),
    );
    if (invalid) {
      setError("Em dias abertos, o horário de início deve ser anterior ao de fim.");
      return;
    }
    const businessHours: BusinessHoursDay[] = days.map((d) =>
      d.closed
        ? { weekday: d.weekday, closed: true }
        : { weekday: d.weekday, closed: false, start: d.start, end: d.end },
    );
    try {
      await updateUnit.mutateAsync({ businessHours });
      toast.success("Horários de funcionamento salvos.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar os horários."));
    }
  }

  return (
    // Largura do proprio conteudo (w-fit): assim o botao "Salvar horarios"
    // (justify-end) alinha com a borda direita dos inputs, e nao com a largura
    // total do card.
    <div className="w-fit space-y-4">
      <div className="space-y-2">
        {days.map((day) => {
          const label = WEEKDAYS.find((w) => w.weekday === day.weekday)!.label;
          return (
            <div key={day.weekday} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-medium">{label}</span>
              <Switch
                checked={!day.closed}
                disabled={pending}
                aria-label={`${label} aberto`}
                onCheckedChange={(open) => toggleOpen(day.weekday, open)}
              />
              {day.closed ? (
                <span className="text-sm text-muted-foreground">Fechado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    step={300}
                    value={day.start ?? ""}
                    disabled={pending}
                    aria-label={`${label} início`}
                    className="w-28"
                    onChange={(e) => patch(day.weekday, { start: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">às</span>
                  <Input
                    type="time"
                    step={300}
                    value={day.end ?? ""}
                    disabled={pending}
                    aria-label={`${label} fim`}
                    className="w-28"
                    onChange={(e) => patch(day.weekday, { end: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
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
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return <BusinessHoursEditor unit={unitQuery.data} />;
}
