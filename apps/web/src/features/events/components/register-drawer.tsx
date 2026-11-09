"use client";

import { useEffect, useMemo } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EventRegistrationView, EventView, Id } from "@gestarahub/contracts";
import { suggestedRegistrationPrice } from "@gestarahub/core/events";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import { formatCents } from "@gestarahub/core/format";
import { ComboboxField, DateField, DialogFormFooter, FieldShell, InputCurrency, SegmentedChoiceField, SelectField } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useClients } from "@/features/clients";
import { usePromoteEventWaitlist, useRegisterForEvent } from "../hooks/use-events";
import { registerFormSchema, type RegisterFormValues } from "../event-schema";
import { dayLabel, sessionTimeLabel } from "../event-copy";

interface RegisterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventView;
  /** Inscritos e espera atuais: ficam fora da escolha. */
  registrations: EventRegistrationView[];
  /** Promover da lista de espera: o aluno ja esta escolhido, so o pagamento. */
  promote?: EventRegistrationView;
}

const INSTALLMENT_OPTIONS = (max: number) =>
  Array.from({ length: Math.min(max, MAX_INSTALLMENTS) }, (_, i) => ({ value: String(i + 1), label: i === 0 ? "À vista" : `${i + 1}x` }));

function RegisterForm({ event, registrations, promote, onClose }: Omit<RegisterDrawerProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const { data: clients } = useClients({ status: "active" });
  const registerMut = useRegisterForEvent();
  const promoteMut = usePromoteEventWaitlist();
  const pending = registerMut.isPending || promoteMut.isPending;
  const today = todayISO();
  const activeDays = useMemo(() => event.sessions.filter((s) => s.status !== "canceled"), [event.sessions]);
  const taken = useMemo(() => new Set(registrations.filter((r) => r.status !== "canceled").map((r) => r.studentId)), [registrations]);
  const paid = event.billingMode !== "free";
  const perDay = event.billingMode === "per_day";
  const fixed = event.billingMode === "fixed";
  // Lotado: a inscricao entra na lista de espera, sem cobranca agora.
  const toWaitlist = !promote && event.isFull;

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      studentId: promote?.studentId ?? "",
      scope: promote?.scope ?? "full",
      sessionIds: promote?.sessionIds ?? [],
      amountCents: suggestedRegistrationPrice(event, promote?.scope ?? "full", promote?.sessionIds?.length ?? activeDays.length, today),
      installments: "1",
      firstDueDate: today,
    },
  });
  const scope = useWatch({ control: form.control, name: "scope" });
  const sessionIds = useWatch({ control: form.control, name: "sessionIds" });
  const dayScope = perDay && scope === "days";

  // Valor sugerido segue a escolha (completa ou dias) enquanto o usuario nao mexeu nele.
  useEffect(() => {
    if (form.getFieldState("amountCents").isDirty) return;
    const count = dayScope ? sessionIds.length : activeDays.length;
    form.setValue("amountCents", suggestedRegistrationPrice(event, dayScope ? "days" : "full", count, today));
  }, [dayScope, sessionIds.length, activeDays.length, event, today, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payment =
      paid && !toWaitlist
        ? {
            amountCents: values.amountCents ?? 0,
            installments: dayScope ? 1 : Number(values.installments),
            firstDueDate: values.firstDueDate || today,
          }
        : undefined;
    try {
      if (promote) {
        await promoteMut.mutateAsync({ registrationId: promote.id, payment });
        toast.success(`${promote.studentName} saiu da lista de espera e está inscrito.`);
      } else {
        const created = await registerMut.mutateAsync({
          eventId: event.id,
          studentId: values.studentId,
          scope: dayScope ? "days" : "full",
          sessionIds: dayScope ? values.sessionIds : undefined,
          payment,
        });
        toast.success(created.status === "waitlist" ? `${created.studentName} entrou na lista de espera.` : `${created.studentName} inscrito.`);
      }
      onClose();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível inscrever.");
    }
  });

  const students = (clients ?? []).filter((c) => !taken.has(c.id) || c.id === promote?.studentId);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {promote ? (
            <p className="text-sm text-foreground">
              <span className="font-medium">{promote.studentName}</span> sai da lista de espera.
            </p>
          ) : (
            <ComboboxField<RegisterFormValues>
              name="studentId"
              label="Aluno"
              required
              placeholder="Escolha o aluno"
              searchPlaceholder="Buscar pelo nome"
              emptyMessage="Nenhum aluno disponível"
              options={students.map((c) => ({ value: c.id, label: c.name }))}
              disabled={pending}
            />
          )}

          {perDay && !promote ? (
            <FieldShell label="Inscrição" required>
              <SegmentedChoiceField<RegisterFormValues>
                name="scope"
                ariaLabel="Inscrição"
                disabled={pending}
                options={[
                  { value: "full", label: "Todos os dias" },
                  { value: "days", label: "Só alguns dias" },
                ]}
              />
            </FieldShell>
          ) : null}

          {dayScope ? (
            <Controller
              control={form.control}
              name="sessionIds"
              render={({ field, fieldState }) => (
                <FieldShell label="Dias" required error={fieldState.error?.message}>
                  <div className="space-y-1.5">
                    {activeDays.map((s) => {
                      const checked = field.value.includes(s.id);
                      return (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/60 px-3 py-2 text-sm">
                          <Checkbox
                            checked={checked}
                            disabled={pending || Boolean(promote)}
                            onCheckedChange={(v) => field.onChange(v ? [...field.value, s.id] : field.value.filter((id: Id) => id !== s.id))}
                          />
                          <span className="font-medium">{dayLabel(s.date)}</span>
                          <span className="text-muted-foreground">{sessionTimeLabel(s)}</span>
                          {event.dayPriceCents ? <span className="ml-auto tabular-nums text-muted-foreground">{formatCents(event.dayPriceCents)}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </FieldShell>
              )}
            />
          ) : null}

          {toWaitlist ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              O evento está lotado: o aluno entra na lista de espera, sem cobrança agora. Quando abrir vaga, promova e cobre.
            </p>
          ) : paid ? (
            <div className="space-y-4 rounded-lg border border-border/60 p-3.5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputCurrency<RegisterFormValues>
                  name="amountCents"
                  label="Valor"
                  required
                  hint={fixed && event.earlyBirdActive ? "Lote aplicado. Pode ajustar." : "Pode ajustar (desconto, cortesia)."}
                  disabled={pending}
                />
                {fixed && !dayScope && (event.maxInstallments ?? 1) > 1 ? (
                  <SelectField<RegisterFormValues> name="installments" label="Parcelas" options={INSTALLMENT_OPTIONS(event.maxInstallments ?? 1)} disabled={pending} />
                ) : null}
              </div>
              <div className="w-48">
                <DateField<RegisterFormValues> name="firstDueDate" label={fixed && !dayScope ? "1º vencimento" : "Vencimento"} required disabled={pending} />
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={false}
          createLabel={toWaitlist ? "Pôr na espera" : "Inscrever"}
          onCancel={onClose}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Inscrever um aluno no evento (ou promover da lista de espera). */
export function RegisterDrawer({ open, onOpenChange, event, registrations, promote: promoteProp }: RegisterDrawerProps) {
  const present = useDialogPresence(open);
  const promote = useRetainedValue(promoteProp);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">{promoteProp ? "Promover da espera" : "Inscrever no evento"}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{event.name}</SheetDescription>
        </SheetHeader>
        {present ? (
          <RegisterForm
            key={promoteProp?.id ?? "new"}
            event={event}
            registrations={registrations}
            promote={promoteProp ? (promote ?? undefined) : undefined}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
