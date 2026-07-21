"use client";

import { useState } from "react";
import {
  useForm,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  FieldShell,
  InputNumber,
  InputText,
  SelectField,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import type {
  ClassGroupView,
  CreateClassGroup,
  Weekday,
} from "@gestarahub/contracts";
import { useCurrentUser } from "@/features/auth";
import { useUnit } from "@/features/settings";
import { useCategories } from "@/features/categories";
import { useProfessionals } from "@/features/professionals";
import { useCreateClassGroup, useUpdateClassGroup } from "../hooks/use-turmas";
import { usePlans } from "../hooks/use-billing";
import { turmaFormSchema, type TurmaFormValues } from "../turma-schema";

const WEEKDAYS = [
  { value: 0, short: "Dom" },
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
];

/** Editor de encontros: um horario aplicado aos dias marcados (gera os slots). */
function MeetingSlotsEditor({
  value,
  onChange,
  disabled,
  error,
}: {
  value: TurmaFormValues["meetingSlots"];
  onChange: (v: TurmaFormValues["meetingSlots"]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [tmpl, setTmpl] = useState(() => ({
    start: value[0]?.start ?? "18:00",
    end: value[0]?.end ?? "19:00",
  }));
  const days = new Set(value.map((s) => s.weekday));

  const write = (nextDays: Set<number>, t: { start: string; end: string }) =>
    onChange(
      [...nextDays]
        .sort((a, b) => a - b)
        .map((weekday) => ({ weekday, start: t.start, end: t.end })),
    );
  const setTime = (patch: Partial<{ start: string; end: string }>) => {
    const t = { ...tmpl, ...patch };
    setTmpl(t);
    write(days, t);
  };
  const toggleDay = (weekday: number) => {
    const next = new Set(days);
    if (next.has(weekday)) next.delete(weekday);
    else next.add(weekday);
    write(next, tmpl);
  };

  return (
    <FieldShell
      label="Encontros"
      error={error}
      hint="A turma se reúne nesses dias, no mesmo horário — gera as aulas."
    >
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Das</span>
          <Input
            type="time"
            step={300}
            value={tmpl.start}
            onChange={(e) => setTime({ start: e.target.value })}
            disabled={disabled}
            aria-label="Início do encontro"
            className="h-8 w-28"
          />
          <span className="text-muted-foreground">às</span>
          <Input
            type="time"
            step={300}
            value={tmpl.end}
            onChange={(e) => setTime({ end: e.target.value })}
            disabled={disabled}
            aria-label="Fim do encontro"
            className="h-8 w-28"
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Dias</p>
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
}

export function TurmaForm({
  turma,
  formId,
  onSuccess,
}: {
  turma?: ClassGroupView;
  formId: string;
  onSuccess: () => void;
}) {
  const createMut = useCreateClassGroup();
  const updateMut = useUpdateClassGroup();
  const isEdit = Boolean(turma);
  const pending = createMut.isPending || updateMut.isPending;
  const user = useCurrentUser();
  const { data: unit } = useUnit();
  const { data: categories } = useCategories({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  const { data: plans } = usePlans({ status: "active" });

  const form = useForm<TurmaFormValues>({
    resolver: zodResolver(turmaFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: turma
      ? {
          name: turma.name,
          modalityId: turma.modalityId ?? "",
          planId: turma.planId ?? "",
          instructorId: turma.instructorId,
          enrollmentType: turma.enrollmentType,
          capacity: turma.capacity,
          startDate: turma.startDate,
          meetingSlots: turma.meetingSlots,
        }
      : {
          name: "",
          modalityId: "",
          planId: "",
          instructorId: "",
          enrollmentType: "fixed",
          capacity: 10,
          startDate: format(new Date(), "yyyy-MM-dd"),
          meetingSlots: [],
        },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateClassGroup = {
      organizationId: user.organizationId,
      unitId: unit?.id ?? "",
      name: values.name,
      modalityId: values.modalityId || undefined,
      planId: values.planId || undefined,
      instructorId: values.instructorId,
      enrollmentType: values.enrollmentType,
      capacity: values.capacity,
      meetingSlots: values.meetingSlots.map((s) => ({
        weekday: s.weekday as Weekday,
        start: s.start,
        end: s.end,
      })),
      startDate: values.startDate,
      status: "active",
    };
    try {
      if (isEdit && turma) {
        await updateMut.mutateAsync({ id: turma.id, payload });
        toast.success("Turma atualizada com sucesso.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Turma criada com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<TurmaFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar a turma."));
      }
    }
  });

  const categoryOptions = (categories ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));
  const instructorOptions = (professionals ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));
  const planOptions = (plans ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <InputText<TurmaFormValues>
          name="name"
          label="Nome"
          placeholder="Ex.: Judô Infantil A"
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<TurmaFormValues>
            name="modalityId"
            label="Modalidade"
            placeholder="Selecione (opcional)"
            options={categoryOptions}
            disabled={pending}
          />
          <SelectField<TurmaFormValues>
            name="instructorId"
            label="Instrutor"
            placeholder="Selecione"
            options={instructorOptions}
            required
            disabled={pending}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<TurmaFormValues>
            name="enrollmentType"
            label="Inscrição"
            options={[
              { label: "Turma fixa (matrícula)", value: "fixed" },
              { label: "Aula avulsa (reserva)", value: "dropin" },
            ]}
            required
            disabled={pending}
          />
          <InputNumber<TurmaFormValues>
            name="capacity"
            label="Capacidade (vagas)"
            min={1}
            disabled={pending}
          />
        </div>

        <SelectField<TurmaFormValues>
          name="planId"
          label="Plano (mensalidade)"
          placeholder="Sem cobrança (opcional)"
          options={planOptions}
          disabled={pending}
        />

        <Controller
          control={form.control}
          name="startDate"
          render={({ field, fieldState }) => (
            <FieldShell
              id="startDate"
              label="Início"
              required
              error={fieldState.error?.message}
            >
              <Input
                id="startDate"
                type="date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={pending}
              />
            </FieldShell>
          )}
        />

        <Controller
          control={form.control}
          name="meetingSlots"
          render={({ field, fieldState }) => (
            <MeetingSlotsEditor
              value={field.value}
              onChange={field.onChange}
              disabled={pending}
              error={fieldState.error?.message}
            />
          )}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Criar turma"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
