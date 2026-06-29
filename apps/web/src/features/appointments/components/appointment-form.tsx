"use client";

import { useForm, useWatch, FormProvider, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FieldShell, SelectField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@/lib/api-error";
import { addMinutesToTime } from "@/lib/scheduling";
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type { AppointmentView, CreateAppointment } from "@/types";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
import { useServices } from "@/features/services/hooks/use-services";
import {
  useCreateAppointment,
  useUpdateAppointment,
} from "../hooks/use-appointments";
import {
  appointmentFormSchema,
  type AppointmentFormValues,
} from "../appointment-schema";

interface AppointmentFormProps {
  /** Quando presente, o form edita o agendamento; senao, cria. */
  appointment?: AppointmentView;
  defaultDate: string;
  defaultProfessionalId?: string;
  onSuccess: () => void;
  formId: string;
}

export function AppointmentForm({
  appointment,
  defaultDate,
  defaultProfessionalId,
  onSuccess,
  formId,
}: AppointmentFormProps) {
  const isEdit = Boolean(appointment);
  const createMut = useCreateAppointment();
  const updateMut = useUpdateAppointment();
  const pending = createMut.isPending || updateMut.isPending;

  const { data: clients } = useClients({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  const { data: services } = useServices({ status: "active" });

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: appointment
      ? {
          clientId: appointment.clientId,
          professionalId: appointment.professionalId,
          serviceId: appointment.serviceId,
          date: appointment.date,
          start: appointment.start,
          notes: appointment.notes ?? "",
        }
      : {
          clientId: "",
          professionalId: defaultProfessionalId ?? "",
          serviceId: "",
          date: defaultDate,
          start: "",
          notes: "",
        },
  });

  const professionalId = useWatch({ control: form.control, name: "professionalId" });
  const serviceId = useWatch({ control: form.control, name: "serviceId" });
  const start = useWatch({ control: form.control, name: "start" });

  const clientOptions = (clients ?? []).map((c) => ({ label: c.name, value: c.id }));
  const professionalOptions = (professionals ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));
  // Servicos oferecidos pelo profissional selecionado (ou todos os ativos).
  const selectedProfessional = (professionals ?? []).find((p) => p.id === professionalId);
  const serviceOptions = (services ?? [])
    .filter((s) => !selectedProfessional || selectedProfessional.serviceIds.includes(s.id))
    .map((s) => ({ label: s.name, value: s.id }));

  const selectedService = (services ?? []).find((s) => s.id === serviceId);
  const endHint =
    selectedService && start
      ? `Duração ${selectedService.durationMinutes} min · termina às ${addMinutesToTime(start, selectedService.durationMinutes)}`
      : selectedService
        ? `Duração ${selectedService.durationMinutes} min`
        : undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateAppointment = {
      organizationId: ORG_ID,
      unitId: UNIT_ID,
      clientId: values.clientId,
      professionalId: values.professionalId,
      serviceId: values.serviceId,
      date: values.date,
      start: values.start,
      notes: values.notes || undefined,
    };
    try {
      if (appointment) {
        await updateMut.mutateAsync({ id: appointment.id, payload });
        toast.success("Agendamento atualizado com sucesso.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Agendamento criado com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<AppointmentFormValues>, { message: f.message });
        }
        // Conflitos (expediente/bloqueio/sobreposicao) tambem como toast.
        toast.error(fields[0].message);
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar o agendamento."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <SelectField<AppointmentFormValues>
          name="clientId"
          label="Cliente"
          placeholder="Selecione o cliente"
          options={clientOptions}
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<AppointmentFormValues>
            name="professionalId"
            label="Profissional"
            placeholder="Selecione"
            options={professionalOptions}
            required
            disabled={pending}
          />
          <SelectField<AppointmentFormValues>
            name="serviceId"
            label="Serviço"
            placeholder="Selecione"
            options={serviceOptions}
            hint={endHint}
            required
            disabled={pending}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="date"
            render={({ field, fieldState }) => (
              <FieldShell id="date" label="Data" required error={fieldState.error?.message}>
                <Input
                  id="date"
                  type="date"
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                />
              </FieldShell>
            )}
          />
          <Controller
            control={form.control}
            name="start"
            render={({ field, fieldState }) => (
              <FieldShell id="start" label="Horário" required error={fieldState.error?.message}>
                <Input
                  id="start"
                  type="time"
                  step={300}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                />
              </FieldShell>
            )}
          />
        </div>

        <TextArea<AppointmentFormValues>
          name="notes"
          label="Observações"
          placeholder="Detalhes do agendamento (opcional)"
          disabled={pending}
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
                : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
