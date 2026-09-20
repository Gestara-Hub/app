"use client";

import { useState } from "react";
import { useForm, useWatch, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { DateField, SelectField, TextArea, TimeField } from "@/components/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { isPastSlot } from "@gestarahub/core/date";
import { addMinutesToTime } from "@gestarahub/core/scheduling";
import type { AppointmentView, SeriesScope } from "@gestarahub/contracts";
import { useProfessionals } from "@/features/professionals";
import {
  useRescheduleAppointment,
  useRescheduleSeriesFuture,
} from "../hooks/use-appointments";

const schema = z.object({
  professionalId: z.string().min(1, "Selecione um profissional."),
  date: z.string().optional(),
  start: z.string().min(1, "Selecione o horário."),
  reason: z.string().trim().optional(),
});
type RescheduleValues = z.infer<typeof schema>;

function RescheduleForm({
  appointment,
  scope,
  onDone,
}: {
  appointment: AppointmentView;
  scope: SeriesScope;
  onDone: () => void;
}) {
  const single = scope === "only_this";
  const rescheduleMut = useRescheduleAppointment();
  const seriesMut = useRescheduleSeriesFuture();
  const pending = rescheduleMut.isPending || seriesMut.isPending;

  const { data: professionals } = useProfessionals({ status: "active" });

  const form = useForm<RescheduleValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      professionalId: appointment.professionalId,
      date: appointment.date,
      start: appointment.start,
      reason: "",
    },
  });

  const start = useWatch({ control: form.control, name: "start" });
  // Valores pendentes quando o novo slot cai no passado (regra mole: confirma).
  const [confirmPast, setConfirmPast] = useState<RescheduleValues | null>(null);

  // Qualquer profissional ativo pode ser escolhido — a associacao
  // profissional↔servico e apenas informativa, nao restringe (idem form de
  // agendar). Assim o profissional original vem sempre pre-selecionado.
  const professionalOptions = (professionals ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));
  const endHint = start
    ? `Termina às ${addMinutesToTime(start, appointment.totalDurationMinutes)}`
    : undefined;

  const doReschedule = async (values: RescheduleValues) => {
    try {
      if (single) {
        await rescheduleMut.mutateAsync({
          id: appointment.id,
          payload: {
            date: values.date,
            start: values.start,
            professionalId: values.professionalId,
            reason: values.reason,
          },
        });
        toast.success("Agendamento remarcado.");
      } else {
        const result = await seriesMut.mutateAsync({
          id: appointment.id,
          payload: {
            start: values.start,
            professionalId: values.professionalId,
            reason: values.reason,
          },
        });
        if (result.conflicts.length > 0) {
          toast.warning(
            `${result.updatedCount} ocorrência(s) remarcada(s); ${result.conflicts.length} em conflito não foram remarcadas.`,
          );
        } else {
          toast.success(`${result.updatedCount} ocorrência(s) remarcada(s).`);
        }
      }
      onDone();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<RescheduleValues>, { message: f.message });
        }
        toast.error(fields[0].message);
      } else {
        toast.error(getErrorMessage(error, "Não foi possível remarcar o agendamento."));
      }
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    if (single && !values.date) {
      form.setError("date", { message: "Selecione a data." });
      return;
    }
    // "Somente esta": checa a data/horario escolhidos. Série: mantém a data de
    // cada ocorrência, então checa a atual com o novo horário.
    const checkDate = single ? values.date : appointment.date;
    const slotChanged = single
      ? values.date !== appointment.date || values.start !== appointment.start
      : values.start !== appointment.start;
    if (slotChanged && isPastSlot(checkDate, values.start)) {
      setConfirmPast(values);
      return;
    }
    void doReschedule(values);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {!single ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Aplica o novo horário/profissional a esta e às próximas ocorrências da
            série (mantém a data de cada uma).
          </p>
        ) : null}

        <SelectField<RescheduleValues>
          name="professionalId"
          label="Profissional"
          placeholder="Selecione"
          options={professionalOptions}
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {single ? (
            <DateField<RescheduleValues> id="rs-date" name="date" label="Data" required disabled={pending} />
          ) : null}
          <TimeField<RescheduleValues>
            id="rs-start"
            name="start"
            label="Horário"
            hint={endHint}
            required
            disabled={pending}
          />
        </div>

        <TextArea<RescheduleValues>
          name="reason"
          label="Motivo (opcional)"
          placeholder="Descreva o motivo, se quiser registrar"
          disabled={pending}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Remarcar"}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog
        open={confirmPast !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPast(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remarcar para um horário no passado?</AlertDialogTitle>
            <AlertDialogDescription>
              A data e o horário escolhidos já passaram. Costuma ser um engano —
              confirme se deseja remarcar mesmo assim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                const values = confirmPast;
                if (values) void doReschedule(values);
              }}
            >
              Remarcar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}

interface RescheduleDialogProps {
  appointment: AppointmentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
}: RescheduleDialogProps) {
  const [scope, setScope] = useState<SeriesScope | null>(null);

  if (!appointment) return null;
  const isSeries = Boolean(appointment.seriesId);
  const effectiveScope: SeriesScope = isSeries ? (scope ?? "only_this") : "only_this";

  const handleOpenChange = (next: boolean) => {
    if (!next) setScope(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="appointment-reschedule"
      >
        <DialogHeader className="pr-14">
          <DialogTitle>Remarcar agendamento</DialogTitle>
          <DialogDescription>
            {appointment.client.name} - {appointment.services.map((s) => s.name).join(" + ")}
          </DialogDescription>
        </DialogHeader>

        {isSeries && scope === null ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este agendamento faz parte de uma série. Remarcar quais ocorrências?
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setScope("only_this")}>
                Somente esta ocorrência
              </Button>
              <Button variant="outline" onClick={() => setScope("this_and_future")}>
                Esta e as futuras
              </Button>
            </div>
          </div>
        ) : (
          <RescheduleForm
            key={effectiveScope}
            appointment={appointment}
            scope={effectiveScope}
            onDone={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
