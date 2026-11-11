"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EventRegistrationView, EventView, Id } from "@gestarahub/contracts";
import { suggestedRegistrationPrice } from "@gestarahub/core/events";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { DateField, DialogFormFooter, FieldShell, InputCurrency, SegmentedChoiceField, SelectField } from "@/components/form";
import { StudentMultiSelect, type StudentPickRow } from "@/components/shared/student-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
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
  const paid = event.billingMode !== "free";
  const perDay = event.billingMode === "per_day";
  const fixed = event.billingMode === "fixed";
  // Lotado: a inscricao entra na lista de espera, sem cobranca agora.
  const toWaitlist = !promote && event.isFull;

  const initialAmount = suggestedRegistrationPrice(event, promote?.scope ?? "full", promote?.sessionIds?.length ?? activeDays.length, today);
  // Ultimo valor sugerido: enquanto o campo mostra ele, a sugestao acompanha
  // a escolha; se o valor for outro, foi a pessoa que mudou e fica o dela.
  const lastSuggested = useRef<number | null>(initialAmount);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      studentIds: promote ? [promote.studentId] : [],
      scope: promote?.scope ?? "full",
      sessionIds: promote?.sessionIds ?? [],
      amountCents: initialAmount,
      installments: "1",
      firstDueDate: today,
    },
  });
  const scope = useWatch({ control: form.control, name: "scope" });
  const sessionIds = useWatch({ control: form.control, name: "sessionIds" });
  const dayScope = perDay && scope === "days";
  const studentIds = useWatch({ control: form.control, name: "studentIds" });
  const selected = useMemo(() => new Set<Id>(studentIds), [studentIds]);
  const [done, setDone] = useState(false);
  const toggleStudent = (id: Id) => {
    // Le o valor atual do formulario: dois cliques seguidos nao podem usar uma lista velha.
    const current = form.getValues("studentIds");
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    form.setValue("studentIds", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };

  // Valor sugerido segue a escolha (completa ou dias) enquanto o usuario nao mexeu nele.
  // Nao usa o `isDirty` do RHF: ele compara com o valor inicial, e o R$ 0 de
  // "Só alguns dias" sem dia marcado contava como editado, travando a
  // sugestao em zero (inscricoes saiam sem cobranca, 10/11/2026).
  useEffect(() => {
    if (form.getValues("amountCents") !== lastSuggested.current) return;
    const count = dayScope ? sessionIds.length : activeDays.length;
    const next = suggestedRegistrationPrice(event, dayScope ? "days" : "full", count, today);
    lastSuggested.current = next;
    form.setValue("amountCents", next);
  }, [dayScope, sessionIds.length, activeDays.length, event, today, form]);

  // Ja inscrito ou na espera aparece desabilitado com o motivo, em vez de sumir.
  const rows: StudentPickRow[] = (clients ?? []).map((c) => {
    const current = registrations.find((r) => r.studentId === c.id && r.status !== "canceled");
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      disabledReason: current ? (current.status === "waitlist" ? "na lista de espera" : "já inscrito") : undefined,
    };
  });
  const onSubmit = form.handleSubmit(async (values) => {
    // Evento pago com valor zero: so com confirmacao (cortesia de proposito).
    if (paid && !toWaitlist && !values.amountCents) {
      const ok = await confirm({
        title: "Inscrever sem cobrança?",
        description: "O valor está em R$ 0,00. Nenhuma cobrança é gerada para esta inscrição.",
        confirmLabel: "Inscrever sem cobrança",
        cancelLabel: "Voltar",
      });
      if (!ok) return;
    }
    const payment =
      paid && !toWaitlist
        ? {
            amountCents: values.amountCents ?? 0,
            installments: dayScope ? 1 : Number(values.installments),
            firstDueDate: values.firstDueDate || today,
          }
        : undefined;
    if (promote) {
      try {
        await promoteMut.mutateAsync({ registrationId: promote.id, payment });
        toast.success(`${promote.studentName} saiu da lista de espera e está inscrito.`);
        onClose();
      } catch (error) {
        handleFormApiError(error, form, "Não foi possível inscrever.");
      }
      return;
    }
    // Em sequencia (nao Promise.all): cada inscricao reavalia a lotacao no
    // "servidor", e o resumo precisa contar quem entrou e quem foi para a espera.
    setDone(true);
    let confirmed = 0;
    let waitlisted = 0;
    let lastError: unknown = null;
    const failed: string[] = [];
    for (const studentId of values.studentIds) {
      try {
        const created = await registerMut.mutateAsync({
          eventId: event.id,
          studentId,
          scope: dayScope ? "days" : "full",
          sessionIds: dayScope ? values.sessionIds : undefined,
          payment,
        });
        if (created.status === "waitlist") waitlisted += 1;
        else confirmed += 1;
      } catch (error) {
        lastError = error;
        failed.push(rows.find((r) => r.id === studentId)?.name ?? "Aluno");
      }
    }
    setDone(false);
    const entered = confirmed + waitlisted;
    if (entered > 0) {
      const parts = [
        confirmed > 0 ? (confirmed === 1 ? "1 inscrito" : `${confirmed} inscritos`) : null,
        waitlisted > 0 ? (waitlisted === 1 ? "1 na lista de espera" : `${waitlisted} na lista de espera`) : null,
      ].filter(Boolean);
      toast.success(entered === 1 && confirmed === 1 ? "Aluno inscrito." : `${parts.join(" e ")}.`);
      onClose();
    }
    // Erro do pagamento volta para o campo quando ninguem entrou; senao so avisa.
    if (lastError) {
      if (entered === 0) handleFormApiError(lastError, form, "Não foi possível inscrever.");
      else toast.error(`Não entrou: ${failed.join(", ")}. ${getErrorMessage(lastError, "Tente de novo.")}`);
    }
  });

  const busy = pending || done;
  const many = studentIds.length > 1;
  const remaining = event.availableSpots;
  const overCapacity = !promote && remaining !== undefined && studentIds.length > remaining;

  return (
    <FormProvider {...form}>
      {confirmDialog}
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {promote ? (
            <p className="text-sm text-foreground">
              <span className="font-medium">{promote.studentName}</span> sai da lista de espera.
            </p>
          ) : (
            <FieldShell label="Alunos" required error={form.formState.errors.studentIds?.message}>
              <StudentMultiSelect rows={rows} selected={selected} onToggle={toggleStudent} disabled={busy} listClassName="max-h-64" />
              {overCapacity && !toWaitlist ? (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  {`Você escolheu ${studentIds.length} para ${plural(remaining ?? 0, "vaga", "vagas")}. Quem passar da lotação entra na lista de espera.`}
                </p>
              ) : remaining !== undefined && !toWaitlist ? (
                <p className="text-xs text-muted-foreground">{`${studentIds.length} de ${plural(remaining, "vaga", "vagas")}`}</p>
              ) : null}
            </FieldShell>
          )}

          {perDay && !promote ? (
            <FieldShell label="Inscrição" required>
              <SegmentedChoiceField<RegisterFormValues>
                name="scope"
                ariaLabel="Inscrição"
                disabled={busy}
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
                            disabled={busy || Boolean(promote)}
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
              O evento está lotado: quem for escolhido entra na lista de espera, sem cobrança agora. Quando abrir vaga, promova e cobre.
            </p>
          ) : paid ? (
            <section aria-label={many ? "Cobrança de cada aluno" : "Cobrança do aluno"} className="space-y-3 rounded-lg border bg-muted/15 p-3.5">
              <p className="text-sm font-medium">{many ? "Cobrança de cada aluno" : "Cobrança do aluno"}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InputCurrency<RegisterFormValues> name="amountCents" label="Valor" required disabled={busy} />
                {fixed && !dayScope && (event.maxInstallments ?? 1) > 1 ? (
                  <SelectField<RegisterFormValues> name="installments" label="Parcelas" options={INSTALLMENT_OPTIONS(event.maxInstallments ?? 1)} disabled={busy} />
                ) : null}
                <DateField<RegisterFormValues> name="firstDueDate" label={fixed && !dayScope ? "1º vencimento" : "Vencimento"} required disabled={busy} />
              </div>
              <p className="text-xs text-muted-foreground">
                {fixed && event.earlyBirdActive ? "Lote aplicado. Pode ajustar." : "Pode ajustar (desconto, cortesia)."}
                {many ? " Vale para cada aluno." : ""}
              </p>
            </section>
          ) : null}
        </DialogBody>
        <DialogFormFooter
          isPending={busy}
          isEdit={false}
          createLabel={toWaitlist ? "Pôr na espera" : promote || studentIds.length <= 1 ? "Inscrever" : `Inscrever ${studentIds.length} alunos`}
          onCancel={onClose}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Inscrever um ou mais alunos no evento (ou promover um da lista de espera). */
export function RegisterDrawer({ open, onOpenChange, event, registrations, promote: promoteProp }: RegisterDrawerProps) {
  const present = useDialogPresence(open);
  const promote = useRetainedValue(promoteProp);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-xl md:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">{promoteProp ? "Promover da espera" : "Inscrever alunos"}</SheetTitle>
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
