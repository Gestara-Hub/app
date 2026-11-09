"use client";

import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Plus, Trash2 } from "lucide-react";
import type { CreateEvent, EventView } from "@gestarahub/contracts";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import {
  ComboboxField,
  DateField,
  DialogFormFooter,
  FieldShell,
  InputCurrency,
  InputNumber,
  InputText,
  SegmentedChoiceField,
  SelectField,
  SwitchField,
  TextArea,
  TimeField,
  type SegmentedChoiceOption,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useCategories } from "@/features/categories";
import { useProfessionals } from "@/features/professionals";
import { useTeamWords } from "@/features/settings";
import { useCreateEvent, useUpdateEvent } from "../hooks/use-events";
import { eventFormSchema, type EventFormValues } from "../event-schema";
import { brDate } from "../event-copy";

const BILLING_OPTIONS: SegmentedChoiceOption[] = [
  { value: "fixed", label: "Valor fechado", description: "Um valor, à vista ou parcelado" },
  { value: "per_day", label: "Por dia", description: "Cada dia tem um valor" },
  { value: "free", label: "Sem cobrança", description: "Evento gratuito" },
];

const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "À vista" : `${i + 1}x`,
}));

function defaults(event?: EventView): EventFormValues {
  const today = todayISO();
  return {
    name: event?.name ?? "",
    modalityId: event?.modalityId ?? "",
    conductor: event && !event.instructorId ? "guest" : "team",
    instructorId: event?.instructorId ?? "",
    guestInstructorName: event?.guestInstructorName ?? "",
    guestInstructorOrigin: event?.guestInstructorOrigin ?? "",
    capacity: event?.capacity ?? null,
    billingMode: event?.billingMode ?? "fixed",
    priceCents: event?.priceCents ?? null,
    maxInstallments: String(event?.maxInstallments ?? 1),
    hasEarlyBird: Boolean(event?.earlyBirdPriceCents),
    earlyBirdPriceCents: event?.earlyBirdPriceCents ?? null,
    earlyBirdUntil: event?.earlyBirdUntil ?? "",
    dayPriceCents: event?.dayPriceCents ?? null,
    countsForProgression: event?.countsForProgression ?? false,
    description: event?.description ?? "",
    sessions: event
      ? event.sessions.map((s) => ({ id: s.id, date: s.date, start: s.start, end: s.end, locked: s.status === "canceled" || s.date <= today }))
      : [{ date: "", start: "09:00", end: "12:00" }],
  };
}

function toPayload(values: EventFormValues): CreateEvent {
  const fixed = values.billingMode === "fixed";
  return {
    name: values.name,
    description: values.description || undefined,
    modalityId: values.modalityId || undefined,
    instructorId: values.conductor === "team" ? values.instructorId || undefined : undefined,
    guestInstructorName: values.conductor === "guest" ? values.guestInstructorName || undefined : undefined,
    guestInstructorOrigin: values.conductor === "guest" ? values.guestInstructorOrigin || undefined : undefined,
    capacity: values.capacity ?? undefined,
    billingMode: values.billingMode,
    priceCents: fixed ? (values.priceCents ?? undefined) : undefined,
    maxInstallments: fixed ? Number(values.maxInstallments) : undefined,
    earlyBirdPriceCents: fixed && values.hasEarlyBird ? (values.earlyBirdPriceCents ?? undefined) : undefined,
    earlyBirdUntil: fixed && values.hasEarlyBird ? values.earlyBirdUntil || undefined : undefined,
    dayPriceCents: values.billingMode === "per_day" ? (values.dayPriceCents ?? undefined) : undefined,
    countsForProgression: values.countsForProgression || undefined,
    sessions: values.sessions.map((s) => ({ ...(s.id ? { id: s.id } : {}), date: s.date, start: s.start, end: s.end })),
  };
}

export function EventForm({ event, onSuccess, onCancel }: { event?: EventView; onSuccess: (saved: EventView) => void; onCancel: () => void }) {
  const isEdit = Boolean(event);
  const team = useTeamWords();
  const { data: categories } = useCategories({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  const createMut = useCreateEvent();
  const updateMut = useUpdateEvent();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: defaults(event),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "sessions" });
  const conductor = useWatch({ control: form.control, name: "conductor" });
  const billingMode = useWatch({ control: form.control, name: "billingMode" });
  const hasEarlyBird = useWatch({ control: form.control, name: "hasEarlyBird" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = toPayload(values);
      const saved = event ? await updateMut.mutateAsync({ id: event.id, payload }) : await createMut.mutateAsync(payload);
      toast.success(event ? "Evento atualizado." : "Evento criado.");
      onSuccess(saved);
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o evento.");
    }
  });

  const addDay = () => {
    const last = form.getValues("sessions").at(-1);
    append({ date: "", start: last?.start ?? "09:00", end: last?.end ?? "12:00" });
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-5">
          <InputText<EventFormValues> name="name" label="Nome" required placeholder="Informe o nome do evento" disabled={pending} />

          <SelectField<EventFormValues>
            name="modalityId"
            label="Modalidade"
            placeholder="Sem modalidade"
            clearable
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            disabled={pending}
          />

          <FieldShell label="Quem conduz" required>
            <SegmentedChoiceField<EventFormValues>
              name="conductor"
              ariaLabel="Quem conduz"
              disabled={pending}
              options={[
                { value: "team", label: "Da equipe" },
                { value: "guest", label: "Convidado" },
              ]}
            />
          </FieldShell>
          {conductor === "team" ? (
            <ComboboxField<EventFormValues>
              name="instructorId"
              label={team.title}
              required
              placeholder={`Escolha o ${team.lower}`}
              searchPlaceholder="Buscar pelo nome"
              emptyMessage="Ninguém encontrado"
              options={(professionals ?? []).map((p) => ({ value: p.id, label: p.name }))}
              disabled={pending}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputText<EventFormValues>
                name="guestInstructorName"
                label="Nome do convidado"
                required
                placeholder="Informe o nome"
                hint="Só o nome: não vira cadastro na equipe."
                disabled={pending}
              />
              <InputText<EventFormValues> name="guestInstructorOrigin" label="De onde vem" placeholder="Academia e cidade" disabled={pending} />
            </div>
          )}

          <FieldShell
            label="Dias"
            required
            hint="Cada dia com início e fim. Um dia com manhã e tarde entra duas vezes."
            error={form.formState.errors.sessions?.message ?? form.formState.errors.sessions?.root?.message}
          >
            <div className="space-y-2">
              {fields.map((field, index) => {
                const locked = Boolean(field.locked);
                return (
                  <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <DateField<EventFormValues> name={`sessions.${index}.date`} label={index === 0 ? "Data" : undefined} disabled={pending || locked} />
                    <div className="w-28">
                      <TimeField<EventFormValues> name={`sessions.${index}.start`} label={index === 0 ? "Início" : undefined} disabled={pending || locked} />
                    </div>
                    <div className="w-28">
                      <TimeField<EventFormValues> name={`sessions.${index}.end`} label={index === 0 ? "Fim" : undefined} disabled={pending || locked} />
                    </div>
                    {locked ? (
                      <span className="inline-flex size-9 items-center justify-center text-muted-foreground" title={`Dia ${brDate(field.date)} já aconteceu`}>
                        <Lock className="size-4" />
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover dia"
                        onClick={() => remove(index)}
                        disabled={pending || fields.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={addDay} disabled={pending}>
                <Plus className="size-4" />
                Adicionar dia
              </Button>
            </div>
          </FieldShell>

          <div className="w-40">
            <InputNumber<EventFormValues> name="capacity" label="Vagas" placeholder="Sem limite" min={1} hint="Lotou, entra na lista de espera." disabled={pending} />
          </div>

          <FieldShell label="Cobrança" required>
            <SegmentedChoiceField<EventFormValues> name="billingMode" ariaLabel="Cobrança" variant="cards" options={BILLING_OPTIONS} disabled={pending} />
          </FieldShell>
          {billingMode === "fixed" ? (
            <div className="space-y-4 rounded-lg border border-border/60 p-3.5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputCurrency<EventFormValues> name="priceCents" label="Valor do evento" required disabled={pending} />
                <SelectField<EventFormValues> name="maxInstallments" label="Parcelas até" options={INSTALLMENT_OPTIONS} disabled={pending} />
              </div>
              <SwitchField<EventFormValues> name="hasEarlyBird" label="Tenho preço de lote" hint="Valor menor até uma data." disabled={pending} />
              {hasEarlyBird ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputCurrency<EventFormValues> name="earlyBirdPriceCents" label="Valor do lote" required disabled={pending} />
                  <DateField<EventFormValues> name="earlyBirdUntil" label="Preço até" required disabled={pending} />
                </div>
              ) : null}
            </div>
          ) : billingMode === "per_day" ? (
            <div className="rounded-lg border border-border/60 p-3.5 sm:w-1/2">
              <InputCurrency<EventFormValues> name="dayPriceCents" label="Valor do dia" required hint="A inscrição pode ser em todos os dias ou só em alguns." disabled={pending} />
            </div>
          ) : null}

          <SwitchField<EventFormValues>
            name="countsForProgression"
            label="Conta para a graduação"
            hint="Presença vale como aula na frequência mínima (exame de faixa coletivo)."
            disabled={pending}
          />

          <TextArea<EventFormValues> name="description" label="Descrição" placeholder="O que acontece no evento (opcional)" disabled={pending} />
        </DialogBody>
        <DialogFormFooter isPending={pending} isEdit={isEdit} onCancel={onCancel} className="shrink-0 border-t border-border/40 bg-background p-6 pt-4" />
      </form>
    </FormProvider>
  );
}
