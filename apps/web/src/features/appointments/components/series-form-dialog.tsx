"use client";

import { useForm, useWatch, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ComboboxField,
  DateField,
  InputNumber,
  MultiSelectField,
  SelectField,
  TimeField,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { frequencyLabel } from "@/lib/labels";
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type { CreateRecurrenceSeries, Frequency } from "@gestarahub/contracts";
import { useClients } from "@/features/clients";
import { useProfessionals } from "@/features/professionals";
import { useServices } from "@/features/services";
import { useCreateSeries } from "../hooks/use-recurrence";
import { seriesFormSchema, type SeriesFormValues } from "../series-schema";

const FREQUENCY_OPTIONS = (["weekly", "biweekly", "monthly"] as Frequency[]).map(
  (value) => ({ value, label: frequencyLabel(value) }),
);
const END_MODE_OPTIONS = [
  { value: "count", label: "Número de ocorrências" },
  { value: "date", label: "Data final" },
];

function SeriesForm({
  formId,
  onSuccess,
}: {
  formId: string;
  onSuccess: () => void;
}) {
  const createMut = useCreateSeries();
  const pending = createMut.isPending;

  const { data: clients } = useClients({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  const { data: services } = useServices({ status: "active" });

  const form = useForm<SeriesFormValues>({
    resolver: zodResolver(seriesFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      clientId: "",
      professionalId: "",
      serviceIds: [],
      frequency: "weekly",
      startDate: "",
      time: "",
      endMode: "count",
      untilOccurrences: 4,
      untilDate: "",
    },
  });

  const professionalId = useWatch({ control: form.control, name: "professionalId" });
  const endMode = useWatch({ control: form.control, name: "endMode" });

  const clientOptions = (clients ?? []).map((c) => ({ label: c.name, value: c.id }));
  const professionalOptions = (professionals ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));
  const selectedProfessional = (professionals ?? []).find((p) => p.id === professionalId);
  const serviceOptions = (services ?? [])
    .filter((s) => !selectedProfessional || selectedProfessional.serviceIds.includes(s.id))
    .map((s) => ({ label: s.name, value: s.id }));

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateRecurrenceSeries = {
      organizationId: ORG_ID,
      unitId: UNIT_ID,
      clientId: values.clientId,
      professionalId: values.professionalId,
      serviceIds: values.serviceIds,
      frequency: values.frequency,
      startDate: values.startDate,
      time: values.time,
      untilOccurrences: values.endMode === "count" ? (values.untilOccurrences ?? undefined) : undefined,
      untilDate: values.endMode === "date" ? values.untilDate : undefined,
    };
    try {
      const result = await createMut.mutateAsync(payload);
      if (result.createdCount === 0) {
        toast.error("Nenhuma ocorrência pôde ser criada (todas em conflito).");
      } else if (result.conflicts.length > 0) {
        toast.warning(
          `${result.createdCount} ocorrência(s) criada(s); ${result.conflicts.length} em conflito não foram criadas. Resolva manualmente.`,
        );
      } else {
        toast.success(`Série criada com ${result.createdCount} ocorrência(s).`);
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<SeriesFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível criar a série."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <ComboboxField<SeriesFormValues>
          name="clientId"
          label="Cliente"
          placeholder="Selecione o cliente"
          searchPlaceholder="Buscar cliente..."
          emptyMessage="Nenhum cliente."
          options={clientOptions}
          required
          disabled={pending}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ComboboxField<SeriesFormValues>
            name="professionalId"
            label="Profissional"
            placeholder="Selecione"
            searchPlaceholder="Buscar profissional..."
            emptyMessage="Nenhum profissional."
            options={professionalOptions}
            required
            disabled={pending}
          />
          <MultiSelectField<SeriesFormValues>
            name="serviceIds"
            label="Serviços"
            placeholder="Selecione"
            searchPlaceholder="Buscar serviço..."
            emptyMessage="Nenhum serviço."
            options={serviceOptions}
            required
            disabled={pending}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField<SeriesFormValues>
            name="frequency"
            label="Frequência"
            options={FREQUENCY_OPTIONS}
            required
            disabled={pending}
          />
          <DateField<SeriesFormValues> id="ser-date" name="startDate" label="Início" required disabled={pending} />
          <TimeField<SeriesFormValues> id="ser-time" name="time" label="Horário" required disabled={pending} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<SeriesFormValues>
            name="endMode"
            label="Terminar por"
            options={END_MODE_OPTIONS}
            disabled={pending}
          />
          {endMode === "count" ? (
            <InputNumber<SeriesFormValues>
              name="untilOccurrences"
              label="Ocorrências"
              min={1}
              max={52}
              disabled={pending}
            />
          ) : (
            <DateField<SeriesFormValues>
              id="ser-until"
              name="untilDate"
              label="Data final"
              required
              disabled={pending}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Criar série"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

interface SeriesFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SeriesFormDialog({
  open,
  onOpenChange,
}: SeriesFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="appointment-series"
      >
        <DialogHeader className="pr-14">
          <DialogTitle>Nova série recorrente</DialogTitle>
          <DialogDescription>
            Repete um compromisso (mesmo cliente, profissional e serviço).
            Ocorrências em conflito não são criadas.
          </DialogDescription>
        </DialogHeader>
        <SeriesForm
          key={String(open)}
          formId="series-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
