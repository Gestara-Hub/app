"use client";

import { useState, useEffect, useRef } from "react";
import {
  useForm,
  useWatch,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DateField,
  FieldShell,
  InputCurrency,
  InputNumber,
  InputText,
  SelectField,
  SwitchField,
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
  const [fallbackTime, setFallbackTime] = useState(() => ({
    start: value[0]?.start ?? "18:00",
    end: value[0]?.end ?? "19:00",
  }));
  const days = new Set(value.map((s) => s.weekday));

  const currentStart = value[0]?.start ?? fallbackTime.start;
  const currentEnd = value[0]?.end ?? fallbackTime.end;

  const setTime = (patch: Partial<{ start: string; end: string }>) => {
    const next = {
      start: patch.start ?? currentStart,
      end: patch.end ?? currentEnd,
    };
    setFallbackTime(next);
    if (value.length > 0) {
      onChange(
        value.map((s) => ({
          ...s,
          start: next.start,
          end: next.end,
        })),
      );
    }
  };

  const toggleDay = (weekday: number) => {
    const nextDays = new Set(days);
    if (nextDays.has(weekday)) nextDays.delete(weekday);
    else nextDays.add(weekday);

    onChange(
      [...nextDays]
        .sort((a, b) => a - b)
        .map((w) => ({ weekday: w, start: currentStart, end: currentEnd })),
    );
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
            value={currentStart}
            onChange={(e) => setTime({ start: e.target.value })}
            disabled={disabled}
            aria-label="Início do encontro"
            className="h-8 w-28"
          />
          <span className="text-muted-foreground">às</span>
          <Input
            type="time"
            step={300}
            value={currentEnd}
            onChange={(e) => setTime({ end: e.target.value })}
            disabled={disabled}
            aria-label="Fim do encontro"
            className="h-8 w-28"
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Dias</p>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.has(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  disabled={disabled}
                  aria-pressed={on}
                  title={`${d.short}: clique para ${on ? "desmarcar" : "marcar"}`}
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
  onSuccess?: (created?: ClassGroupView) => void;
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
          allowDropin: turma.allowDropin ?? false,
          sessionPriceCents: turma.sessionPriceCents ?? 0,
          capacity: turma.capacity,
          startDate: turma.startDate,
          meetingSlots: turma.meetingSlots,
        }
      : {
          name: "",
          modalityId: "",
          planId: "",
          instructorId: "",
          allowDropin: false,
          sessionPriceCents: 0,
          capacity: 10,
          startDate: format(new Date(), "yyyy-MM-dd"),
          meetingSlots: [],
        },
  });

  const allowDropin = useWatch({
    control: form.control,
    name: "allowDropin",
  });

  const modalityId = useWatch({
    control: form.control,
    name: "modalityId",
  });

  const instructorId = useWatch({
    control: form.control,
    name: "instructorId",
  });

  // Rastreia a última modalidade para detectar mudanças
  const prevModalityRef = useRef<string>(turma?.modalityId ?? "");

  // Ao alterar a modalidade, valida se o instrutor atual continua elegível ou auto-seleciona se houver apenas 1
  useEffect(() => {
    if (prevModalityRef.current === modalityId) return;
    prevModalityRef.current = modalityId;

    if (!modalityId) {
      if (instructorId) {
        form.setValue("instructorId", "", { shouldValidate: true });
      }
      return;
    }

    const eligible = (professionals ?? []).filter((p) =>
      (p.modalityIds ?? []).includes(modalityId),
    );

    if (instructorId && !eligible.some((p) => p.id === instructorId)) {
      form.setValue("instructorId", "", { shouldValidate: true });
    } else if (!instructorId && eligible.length === 1) {
      form.setValue("instructorId", eligible[0].id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [modalityId, instructorId, professionals, form]);

  // Rastreia o último instrutor carregado para não sobrescrever em loop nem
  // alterar slots já salvos na abertura de edição de uma turma existente.
  const lastLoadedInstructorRef = useRef<string>(turma?.instructorId ?? "");

  useEffect(() => {
    if (!instructorId) {
      lastLoadedInstructorRef.current = "";
      return;
    }

    if (lastLoadedInstructorRef.current === instructorId) {
      return;
    }

    const prof = (professionals ?? []).find((p) => p.id === instructorId);
    if (!prof) return;

    lastLoadedInstructorRef.current = instructorId;

    const validHours = (prof.workingHours ?? []).filter(
      (wh) => wh.start && wh.end && wh.start < wh.end,
    );

    if (validHours.length > 0) {
      const slots = validHours.map((wh) => ({
        weekday: wh.weekday,
        start: wh.start,
        end: wh.end,
      }));
      form.setValue("meetingSlots", slots, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [instructorId, professionals, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateClassGroup = {
      organizationId: user.organizationId,
      unitId: unit?.id ?? "",
      name: values.name,
      modalityId: values.modalityId,
      planId: values.planId || undefined,
      instructorId: values.instructorId,
      allowDropin: values.allowDropin,
      sessionPriceCents: values.allowDropin ? (values.sessionPriceCents || undefined) : undefined,
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
        onSuccess?.();
      } else {
        const created = await createMut.mutateAsync(payload);
        toast.success("Turma criada com sucesso.");
        onSuccess?.(created);
      }
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
  const eligibleInstructors = (professionals ?? []).filter((p) =>
    modalityId ? (p.modalityIds ?? []).includes(modalityId) : false,
  );
  const instructorOptions = eligibleInstructors.map((p) => ({
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
          label="Nome da turma"
          placeholder="Ex.: Inglês Básico, Dança Kids, Turma A"
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<TurmaFormValues>
            name="modalityId"
            label="Modalidade / Curso"
            placeholder="Selecione a modalidade"
            options={categoryOptions}
            required
            disabled={pending}
          />
          <SelectField<TurmaFormValues>
            name="instructorId"
            label="Professor / Instrutor"
            placeholder={
              !modalityId
                ? "Selecione a modalidade primeiro"
                : instructorOptions.length === 0
                  ? "Nenhum professor leciona esta modalidade"
                  : "Selecione o professor"
            }
            options={instructorOptions}
            required
            disabled={pending || !modalityId || instructorOptions.length === 0}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputNumber<TurmaFormValues>
            name="capacity"
            label="Capacidade (vagas)"
            min={1}
            disabled={pending}
          />
          <SelectField<TurmaFormValues>
            name="planId"
            label="Plano de mensalidade"
            placeholder="Sem cobrança (opcional)"
            options={planOptions}
            disabled={pending}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
          <SwitchField<TurmaFormValues>
            name="allowDropin"
            label="Permitir aulas avulsas nesta turma"
            hint="Alunos poderão reservar aulas avulsas nas vagas restantes desta turma."
            disabled={pending}
          />

          {allowDropin ? (
            <InputCurrency<TurmaFormValues>
              name="sessionPriceCents"
              label="Valor da aula avulsa"
              disabled={pending}
            />
          ) : null}
        </div>

        <DateField<TurmaFormValues> name="startDate" label="Início" required disabled={pending} />

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
