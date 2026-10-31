"use client";

import { useMemo } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Id, ModalityMeasure, StudentMeasurement } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { MAX_MEASUREMENT_NOTES_LENGTH, normalizeMeasureValue } from "@gestarahub/core/measurements";
import { DateField, DialogFormFooter, FieldShell, TextArea, fieldAria } from "@/components/form";
import { DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCreateMeasurement, useUpdateMeasurement } from "../hooks/use-measurements";

interface Values {
  date: string;
  values: Record<string, string>;
  notes: string;
}

/** Data, um campo por medida (vazio = nao medido) e observacao; pelo menos uma medida. */
function schemaFor(measures: readonly ModalityMeasure[]) {
  return z
    .object({
      date: z.string().min(1, "Informe a data."),
      values: z.record(z.string(), z.string()),
      notes: z.string().max(MAX_MEASUREMENT_NOTES_LENGTH, `Use até ${MAX_MEASUREMENT_NOTES_LENGTH} caracteres.`),
    })
    .superRefine((v, ctx) => {
      let filled = 0;
      for (const m of measures) {
        const raw = v.values[m.id]?.trim() ?? "";
        if (!raw) continue;
        filled += 1;
        const check = normalizeMeasureValue(raw);
        if (!check.ok) ctx.addIssue({ code: "custom", path: ["values", m.id], message: check.message });
      }
      if (filled === 0 && measures[0]) {
        ctx.addIssue({ code: "custom", path: ["values", measures[0].id], message: "Preencha pelo menos uma medida." });
      }
    });
}

const decimalText = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false });

function MeasurementForm({
  studentId,
  modalityId,
  measures,
  measurement,
  onDone,
}: {
  studentId: Id;
  modalityId: Id;
  measures: ModalityMeasure[];
  measurement?: StudentMeasurement;
  onDone: () => void;
}) {
  const createMut = useCreateMeasurement();
  const updateMut = useUpdateMeasurement();
  const pending = createMut.isPending || updateMut.isPending;
  const schema = useMemo(() => schemaFor(measures), [measures]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      date: measurement?.date ?? todayISO(),
      values: Object.fromEntries(
        measures.map((m) => {
          const value = measurement?.values[m.id];
          return [m.id, typeof value === "number" ? decimalText(value) : ""];
        }),
      ),
      notes: measurement?.notes ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    const values: Record<string, number> = {};
    for (const m of measures) {
      const check = normalizeMeasureValue(v.values[m.id]?.trim() ?? "");
      if (check.ok) values[m.id] = check.value;
    }
    try {
      if (measurement) {
        await updateMut.mutateAsync({ id: measurement.id, payload: { date: v.date, values, notes: v.notes } });
        toast.success("Avaliação atualizada.");
      } else {
        await createMut.mutateAsync({ studentId, modalityId, date: v.date, values, notes: v.notes });
        toast.success("Avaliação registrada.");
      }
      onDone();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar a avaliação.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <div className="w-44">
            <DateField<Values> name="date" label="Data" required disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {measures.map((m) => {
              const id = `measure-${m.id}`;
              const label = m.unit ? `${m.name} (${m.unit})` : m.name;
              return (
                <Controller
                  key={m.id}
                  control={form.control}
                  name={`values.${m.id}`}
                  render={({ field, fieldState }) => (
                    <FieldShell id={id} label={label} error={fieldState.error?.message}>
                      <Input
                        id={id}
                        inputMode="decimal"
                        autoComplete="off"
                        className="text-base tabular-nums md:text-sm"
                        disabled={pending}
                        {...field}
                        value={field.value ?? ""}
                        {...fieldAria(id, fieldState.error?.message)}
                      />
                    </FieldShell>
                  )}
                />
              );
            })}
          </div>
          <TextArea<Values>
            name="notes"
            label="Observação (opcional)"
            placeholder="Anote o que ajuda na próxima avaliação"
            rows={3}
            maxLength={MAX_MEASUREMENT_NOTES_LENGTH}
            disabled={pending}
          />
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={Boolean(measurement)}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Nova avaliacao de testes e medidas, ou edicao. */
export function MeasurementFormDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  modality: modalityProp,
  measurement: measurementProp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id;
  studentName: string;
  modality: { id: Id; name: string; measures: ModalityMeasure[] } | null;
  measurement?: StudentMeasurement;
}) {
  // Enquanto fecha, mantem o formulario montado (titulo e campos nao somem antes da animacao).
  const modality = useRetainedValue(modalityProp);
  const measurement = useRetainedValue(measurementProp) ?? undefined;
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 p-6 pb-4 border-b border-border/40 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {measurement ? "Editar avaliação" : "Nova avaliação"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {[studentName, modality?.name].filter(Boolean).join(" · ")}
          </SheetDescription>
        </SheetHeader>
        {present && modality ? (
          <MeasurementForm
            key={measurement?.id ?? `new-${modality.id}`}
            studentId={studentId}
            modalityId={modality.id}
            measures={modality.measures}
            measurement={measurement}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
