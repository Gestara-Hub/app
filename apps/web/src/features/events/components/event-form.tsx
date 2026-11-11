"use client";

import { useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Lock, Plus, Trash2 } from "lucide-react";
import type { CreateEvent, EventView, Id } from "@gestarahub/contracts";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import {
  ComboboxField,
  DateField,
  DialogFormFooter,
  FieldShell,
  FormSection,
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
import { newId } from "@/lib/new-id";
import { cn } from "@/lib/utils";
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

function newInstructor(): EventFormValues["instructors"][number] {
  return { id: newId(), kind: "team", professionalId: "", guestName: "", guestOrigin: "" };
}

function defaults(event?: EventView): EventFormValues {
  const today = todayISO();
  return {
    name: event?.name ?? "",
    modalityId: event?.modalityId ?? "",
    instructors: event
      ? event.instructors.map((i) => ({
          id: i.id,
          kind: i.professionalId ? ("team" as const) : ("guest" as const),
          professionalId: i.professionalId ?? "",
          guestName: i.guestName ?? "",
          guestOrigin: i.guestOrigin ?? "",
        }))
      : [newInstructor()],
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
      ? event.sessions.map((s) => ({
          id: s.id,
          date: s.date,
          start: s.start,
          end: s.end,
          instructorIds: s.instructorIds ?? [],
          locked: s.status === "canceled" || s.date <= today,
        }))
      : [{ date: "", start: "09:00", end: "12:00", instructorIds: [] }],
  };
}

function toPayload(values: EventFormValues): CreateEvent {
  const fixed = values.billingMode === "fixed";
  return {
    name: values.name,
    description: values.description || undefined,
    modalityId: values.modalityId || undefined,
    instructors: values.instructors.map((i) =>
      i.kind === "team"
        ? { id: i.id, professionalId: i.professionalId || undefined }
        : { id: i.id, guestName: i.guestName || undefined, guestOrigin: i.guestOrigin || undefined },
    ),
    capacity: values.capacity ?? undefined,
    billingMode: values.billingMode,
    priceCents: fixed ? (values.priceCents ?? undefined) : undefined,
    maxInstallments: fixed ? Number(values.maxInstallments) : undefined,
    earlyBirdPriceCents: fixed && values.hasEarlyBird ? (values.earlyBirdPriceCents ?? undefined) : undefined,
    earlyBirdUntil: fixed && values.hasEarlyBird ? values.earlyBirdUntil || undefined : undefined,
    dayPriceCents: values.billingMode === "per_day" ? (values.dayPriceCents ?? undefined) : undefined,
    countsForProgression: values.countsForProgression || undefined,
    sessions: values.sessions.map((s) => {
      // So ids que continuam na lista; nenhum escolhido = todos conduzem o bloco.
      const instructorIds = s.instructorIds.filter((id) => values.instructors.some((i) => i.id === id));
      return { ...(s.id ? { id: s.id } : {}), date: s.date, start: s.start, end: s.end, ...(instructorIds.length ? { instructorIds } : {}) };
    }),
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
  const instructors = useWatch({ control: form.control, name: "instructors" });
  // Nome de cada pessoa da lista (para os chips dos dias); inativo no evento antigo usa o nome salvo.
  const instructorNames = new Map<Id, string>(
    instructors.map((i) => [
      i.id,
      i.kind === "team"
        ? ((professionals ?? []).find((p) => p.id === i.professionalId)?.name ??
          event?.instructors.find((e) => e.professionalId === i.professionalId)?.name ??
          "")
        : (i.guestName ?? "").trim(),
    ]),
  );
  const named = instructors.filter((i) => instructorNames.get(i.id));
  const billingMode = useWatch({ control: form.control, name: "billingMode" });
  const hasEarlyBird = useWatch({ control: form.control, name: "hasEarlyBird" });
  // Descricao e opcional: recolhida em "+ Adicionar descrição" ate ter texto.
  const [showDescription, setShowDescription] = useState(Boolean(event?.description));

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
    append({ date: "", start: last?.start ?? "09:00", end: last?.end ?? "12:00", instructorIds: [] });
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-8 sm:space-y-4">
          {/* Mesma ordem do cadastro de turma (doc 07 §2.9): sobre, quem conduz, quando, vagas e cobranca. */}
          <FormSection title="Sobre o evento">
            <InputText<EventFormValues> name="name" label="Nome" required placeholder="Informe o nome do evento" disabled={pending} />
            <SelectField<EventFormValues>
              name="modalityId"
              label="Modalidade"
              placeholder="Sem modalidade"
              clearable
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              disabled={pending}
            />
            {showDescription ? (
              <TextArea<EventFormValues> name="description" label="Descrição" placeholder="O que acontece no evento" disabled={pending} />
            ) : (
              <Button type="button" variant="ghost" className="-ml-3 text-muted-foreground" onClick={() => setShowDescription(true)} disabled={pending}>
                <Plus className="size-4" />
                Adicionar descrição
              </Button>
            )}
          </FormSection>

          <FormSection title="Quem conduz">
            <InstructorsField form={form} professionals={professionals ?? []} event={event} teamTitle={team.title} pending={pending} />
          </FormSection>

          <FormSection title="Quando">
            <FieldShell
              label="Dias"
              required
              hint={
                named.length > 1
                  ? "Cada dia com início e fim; marque quem conduz o bloco (sem marcar, todos). Manhã e tarde entram duas vezes."
                  : "Cada dia com início e fim. Um dia com manhã e tarde entra duas vezes."
              }
              error={form.formState.errors.sessions?.message ?? form.formState.errors.sessions?.root?.message}
            >
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_7rem_7rem_2rem] items-end gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Data</span>
                  <span>Início</span>
                  <span>Fim</span>
                  <span aria-hidden />
                </div>
                <div className="divide-y divide-border/60">
                  {fields.map((field, index) => {
                    const locked = Boolean(field.locked);
                    return (
                      // Celular: data em cima e horarios embaixo; desktop: tudo numa linha sob o cabecalho.
                      <div key={field.id} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2 py-2 first:pt-0 sm:grid-cols-[1fr_7rem_7rem_2rem]">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <DateField<EventFormValues> name={`sessions.${index}.date`} disabled={pending || locked} />
                        </div>
                        <div className="col-start-3 row-start-1 sm:col-start-4">
                          {locked ? (
                            <span className="inline-flex size-8 items-center justify-center text-muted-foreground" title={`Dia ${brDate(field.date)} já aconteceu`}>
                              <Lock className="size-4" />
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remover dia"
                              onClick={() => remove(index)}
                              disabled={pending || fields.length === 1}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                        <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                          <TimeField<EventFormValues> name={`sessions.${index}.start`} disabled={pending || locked} />
                        </div>
                        <div className="min-w-0 sm:col-start-3 sm:row-start-1">
                          <TimeField<EventFormValues> name={`sessions.${index}.end`} disabled={pending || locked} />
                        </div>
                        {named.length > 1 ? (
                          <div className="col-span-3 sm:col-span-4">
                            <DayInstructorChips form={form} index={index} options={named.map((i) => ({ id: i.id, name: instructorNames.get(i.id) ?? "" }))} disabled={pending || locked} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <Button type="button" variant="outline" onClick={addDay} disabled={pending}>
                  <Plus className="size-4" />
                  Adicionar dia
                </Button>
              </div>
            </FieldShell>
          </FormSection>

          <FormSection title="Vagas e cobrança">
            <div className="sm:w-1/2 sm:pr-2">
              <InputNumber<EventFormValues> name="capacity" label="Vagas" placeholder="Sem limite" min={1} hint="Lotou, entra na lista de espera." disabled={pending} />
            </div>
            <FieldShell label="Cobrança" required>
              <SegmentedChoiceField<EventFormValues> name="billingMode" ariaLabel="Cobrança" variant="cards" options={BILLING_OPTIONS} disabled={pending} />
            </FieldShell>
            {billingMode === "fixed" ? (
              // Valores direto no formulario, sem card (10/11/2026, a pedido).
              <div className="space-y-4">
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
              <div className="sm:w-1/2 sm:pr-2">
                <InputCurrency<EventFormValues> name="dayPriceCents" label="Valor do dia" required hint="A inscrição pode ser em todos os dias ou só em alguns." disabled={pending} />
              </div>
            ) : null}
            <SwitchField<EventFormValues>
              name="countsForProgression"
              label="Conta para a graduação"
              hint="Presença vale como aula na frequência mínima (exame de faixa coletivo)."
              disabled={pending}
            />
          </FormSection>
        </DialogBody>
        <DialogFormFooter isPending={pending} isEdit={isEdit} onCancel={onCancel} className="shrink-0 border-t border-border/40 bg-background p-6 pt-4" />
      </form>
    </FormProvider>
  );
}

type ProfessionalOption = { id: Id; name: string };

/** Quem conduz: uma ou mais pessoas, cada uma da equipe ou convidada. */
function InstructorsField({
  form,
  professionals,
  event,
  teamTitle,
  pending,
}: {
  form: UseFormReturn<EventFormValues>;
  professionals: ProfessionalOption[];
  event?: EventView;
  teamTitle: string;
  pending: boolean;
}) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "instructors", keyName: "fieldKey" });
  const kinds = useWatch({ control: form.control, name: "instructors" });
  const errors = form.formState.errors.instructors;
  // Profissional inativado depois continua aparecendo no evento que ja conduzia.
  const options = [
    ...professionals.map((p) => ({ value: p.id, label: p.name })),
    ...(event?.instructors ?? [])
      .filter((i) => i.professionalId && !professionals.some((p) => p.id === i.professionalId))
      .map((i) => ({ value: i.professionalId as string, label: i.name })),
  ];

  const removeAt = (index: number) => {
    const id = form.getValues(`instructors.${index}.id`);
    remove(index);
    // Quem sai da lista sai tambem da escolha dos dias que ainda podem mudar.
    form.getValues("sessions").forEach((s, i) => {
      if (s.locked || !s.instructorIds.includes(id)) return;
      form.setValue(
        `sessions.${i}.instructorIds`,
        s.instructorIds.filter((x) => x !== id),
        { shouldDirty: true },
      );
    });
  };

  const many = fields.length > 1;
  return (
    // Uma pessoa: o seletor Equipe/Convidado em cima e o campo embaixo, sem caixa.
    // Duas ou mais: uma linha por pessoa numa lista com borda e a lixeira.
    <FieldShell label="Quem conduz" required error={errors?.message ?? errors?.root?.message}>
      <div className="space-y-3">
        <div className={cn(many && "divide-y divide-border/60 rounded-lg border border-border/60 px-3")}>
          {fields.map((field, index) => {
            const kind = kinds[index]?.kind ?? "team";
            return (
              <div key={field.fieldKey} className={cn("space-y-3", many && "py-3")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-full sm:w-64">
                    <SegmentedChoiceField<EventFormValues>
                      name={`instructors.${index}.kind`}
                      ariaLabel="Da equipe ou convidado"
                      disabled={pending}
                      options={[
                        { value: "team", label: "Da equipe" },
                        { value: "guest", label: "Convidado" },
                      ]}
                    />
                  </div>
                  {many ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover quem conduz" onClick={() => removeAt(index)} disabled={pending}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                {kind === "team" ? (
                  <ComboboxField<EventFormValues>
                    name={`instructors.${index}.professionalId`}
                    label={teamTitle}
                    required
                    placeholder="Escolha quem conduz"
                    searchPlaceholder="Buscar pelo nome"
                    emptyMessage="Ninguém encontrado"
                    options={options}
                    disabled={pending}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InputText<EventFormValues>
                      name={`instructors.${index}.guestName`}
                      label="Nome do convidado"
                      required
                      placeholder="Informe o nome"
                      hint="Só o nome: não vira cadastro na equipe."
                      disabled={pending}
                    />
                    <InputText<EventFormValues> name={`instructors.${index}.guestOrigin`} label="De onde vem" placeholder="Academia e cidade" disabled={pending} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" onClick={() => append(newInstructor())} disabled={pending}>
          <Plus className="size-4" />
          Adicionar quem conduz
        </Button>
      </div>
    </FieldShell>
  );
}

/** Quem conduz o bloco: chips com quem esta na lista; nenhum marcado = todos. */
function DayInstructorChips({
  form,
  index,
  options,
  disabled,
}: {
  form: UseFormReturn<EventFormValues>;
  index: number;
  options: { id: Id; name: string }[];
  disabled: boolean;
}) {
  const chosen = useWatch({ control: form.control, name: `sessions.${index}.instructorIds` }) ?? [];
  const toggle = (id: Id) => {
    const current = form.getValues(`sessions.${index}.instructorIds`) ?? [];
    form.setValue(
      `sessions.${index}.instructorIds`,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      { shouldDirty: true },
    );
  };
  return (
    <div role="group" aria-label="Quem conduz este dia" className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-xs text-muted-foreground">Conduz:</span>
      {options.map((o) => {
        const on = chosen.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(o.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {on ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
            <span className="min-w-0 break-words">{o.name}</span>
          </button>
        );
      })}
      {chosen.length === 0 ? <span className="text-xs text-muted-foreground">(todos)</span> : null}
    </div>
  );
}
