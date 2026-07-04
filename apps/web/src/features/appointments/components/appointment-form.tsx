"use client";

import { useState } from "react";
import { useForm, useWatch, FormProvider, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { Info, Plus } from "lucide-react";
import {
  ComboboxField,
  FieldShell,
  MultiSelectField,
  TextArea,
} from "@/components/form";
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
import { Input } from "@/components/ui/input";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { isPastSlot } from "@gestarahub/core/date";
import { formatCents } from "@gestarahub/core/format";
import { addMinutesToTime } from "@gestarahub/core/scheduling";
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import { isApiError } from "@gestarahub/contracts";
import type { AppointmentView, CreateAppointment } from "@gestarahub/contracts";
import { useClients } from "@/features/clients";
import { useProfessionals } from "@/features/professionals";
import { useServices } from "@/features/services";
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
  defaultProfessionalId?: string;
  defaultDate?: string;
  defaultStart?: string;
  onSuccess: () => void;
  formId: string;
}

export function AppointmentForm({
  appointment,
  defaultProfessionalId,
  defaultDate,
  defaultStart,
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

  // Um agendamento exige cliente + profissional + servico, cada um cadastrado em
  // sua tela. Como sao tres, consolida os que faltam num aviso unico (evita
  // repetir um alerta em cada campo). `undefined` durante o load nao conta.
  const noClients = clients?.length === 0;
  const noProfessionals = professionals?.length === 0;
  const noServices = services?.length === 0;
  const missingPrereqs = [
    { key: "clients", label: "Clientes", href: "/clients", missing: noClients },
    { key: "professionals", label: "Equipe", href: "/team", missing: noProfessionals },
    { key: "services", label: "Serviços", href: "/services", missing: noServices },
  ].filter((p) => p.missing);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: appointment
      ? {
          clientId: appointment.clientId,
          professionalId: appointment.professionalId,
          serviceIds: appointment.serviceIds,
          date: appointment.date,
          start: appointment.start,
          notes: appointment.notes ?? "",
        }
      : {
          clientId: "",
          professionalId: defaultProfessionalId ?? "",
          serviceIds: [],
          date: defaultDate ?? "", // vazio: o usuario escolhe a data
          start: defaultStart ?? "",
          notes: "",
        },
  });

  const professionalId = useWatch({ control: form.control, name: "professionalId" });
  const serviceIds = useWatch({ control: form.control, name: "serviceIds" });
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

  const selectedServices = (services ?? []).filter((s) =>
    (serviceIds ?? []).includes(s.id),
  );
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.priceCents, 0);
  const endHint =
    selectedServices.length === 0
      ? undefined
      : `Duração ${totalDuration} min · ${formatCents(totalPrice)}${
          start ? ` · termina às ${addMinutesToTime(start, totalDuration)}` : ""
        }`;

  // Valores pendentes quando o slot cai no almoco — abre a confirmacao.
  const [confirmBreak, setConfirmBreak] = useState<AppointmentFormValues | null>(
    null,
  );
  // Idem quando o slot escolhido esta no passado (regra mole: confirma).
  const [confirmPast, setConfirmPast] = useState<AppointmentFormValues | null>(
    null,
  );

  const submit = async (values: AppointmentFormValues, allowBreak: boolean) => {
    const payload: CreateAppointment = {
      organizationId: ORG_ID,
      unitId: UNIT_ID,
      clientId: values.clientId,
      professionalId: values.professionalId,
      serviceIds: values.serviceIds,
      date: values.date,
      start: values.start,
      notes: values.notes || undefined,
    };
    try {
      if (appointment) {
        await updateMut.mutateAsync({ id: appointment.id, payload, allowBreak });
        toast.success("Agendamento atualizado com sucesso.");
      } else {
        await createMut.mutateAsync({ payload, allowBreak });
        toast.success("Agendamento criado com sucesso.");
      }
      onSuccess();
    } catch (error) {
      // Almoco e regra "mole": em vez de barrar, pede confirmacao para agendar
      // mesmo assim. Bloqueio/sobreposicao/expediente seguem como erro normal.
      if (!allowBreak && isApiError(error) && error.code === "ON_BREAK") {
        setConfirmBreak(values);
        return;
      }
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
  };

  const onSubmit = form.handleSubmit((values) => {
    // Slot no passado costuma ser engano — confirma antes (regra mole). Ao
    // editar, so alerta se a data/horario mudou (nao incomoda ao mexer so nas
    // observacoes de um agendamento ja passado).
    const slotChanged =
      !appointment ||
      values.date !== appointment.date ||
      values.start !== appointment.start;
    if (slotChanged && isPastSlot(values.date, values.start)) {
      setConfirmPast(values);
      return;
    }
    void submit(values, false);
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        {missingPrereqs.length > 0 ? (
          <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/40 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Antes de agendar, cadastre</p>
                <p className="text-xs text-muted-foreground">
                  Um agendamento precisa de cliente, profissional e serviço.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingPrereqs.map((prereq) => (
                  <Button
                    key={prereq.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link href={prereq.href}>
                      <Plus className="size-3.5" />
                      {prereq.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <ComboboxField<AppointmentFormValues>
          name="clientId"
          label="Cliente"
          placeholder={noClients ? "Nenhum cliente cadastrado" : "Selecione o cliente"}
          searchPlaceholder="Buscar cliente..."
          emptyMessage="Nenhum cliente."
          options={clientOptions}
          required
          disabled={pending || noClients}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ComboboxField<AppointmentFormValues>
            name="professionalId"
            label="Profissional"
            placeholder={noProfessionals ? "Nenhum profissional cadastrado" : "Selecione"}
            searchPlaceholder="Buscar profissional..."
            emptyMessage="Nenhum profissional."
            options={professionalOptions}
            required
            disabled={pending || noProfessionals}
          />
          <MultiSelectField<AppointmentFormValues>
            name="serviceIds"
            label="Serviços"
            placeholder={noServices ? "Nenhum serviço cadastrado" : "Selecione"}
            searchPlaceholder="Buscar serviço..."
            emptyMessage="Nenhum serviço."
            options={serviceOptions}
            hint={endHint}
            required
            disabled={pending || noServices}
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
          <Button type="submit" disabled={pending || missingPrereqs.length > 0}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog
        open={confirmBreak !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmBreak(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Agendar durante o intervalo?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProfessional?.name ?? "O profissional"} está em intervalo
              (almoço) neste horário. Deseja agendar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                const values = confirmBreak;
                if (values) void submit(values, true);
              }}
            >
              Agendar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmPast !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPast(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Agendar para um horário no passado?</AlertDialogTitle>
            <AlertDialogDescription>
              A data e o horário escolhidos já passaram. Costuma ser um engano de
              digitação — confirme se deseja registrar mesmo assim (ex.: lançar um
              atendimento que já ocorreu).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                const values = confirmPast;
                if (values) void submit(values, false);
              }}
            >
              Agendar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}
