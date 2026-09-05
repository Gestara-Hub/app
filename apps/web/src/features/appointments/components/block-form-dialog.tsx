"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ComboboxField, DateField, TextArea, TimeField } from "@/components/form";
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
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type { CreateTimeBlock } from "@gestarahub/contracts";
import { useProfessionals } from "@/features/professionals";
import { useCreateTimeBlock } from "../hooks/use-time-blocks";
import { blockFormSchema, type BlockFormValues } from "../block-schema";

function BlockForm({
  formId,
  onSuccess,
}: {
  formId: string;
  onSuccess: () => void;
}) {
  const createMut = useCreateTimeBlock();
  const pending = createMut.isPending;
  const { data: professionals } = useProfessionals({ status: "active" });

  const form = useForm<BlockFormValues>({
    resolver: zodResolver(blockFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      professionalId: "",
      date: "",
      start: "",
      end: "",
      reason: "",
    },
  });

  const professionalOptions = (professionals ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateTimeBlock = {
      organizationId: ORG_ID,
      unitId: UNIT_ID,
      professionalId: values.professionalId,
      date: values.date,
      start: values.start,
      end: values.end,
      reason: values.reason || undefined,
    };
    try {
      await createMut.mutateAsync(payload);
      toast.success("Bloqueio criado.");
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<BlockFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível criar o bloqueio."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <ComboboxField<BlockFormValues>
          name="professionalId"
          label="Profissional"
          placeholder="Selecione"
          searchPlaceholder="Buscar profissional..."
          emptyMessage="Nenhum profissional."
          options={professionalOptions}
          required
          disabled={pending}
        />
        <DateField<BlockFormValues> id="blk-date" name="date" label="Data" required disabled={pending} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TimeField<BlockFormValues> id="blk-start" name="start" label="Início" required disabled={pending} />
          <TimeField<BlockFormValues> id="blk-end" name="end" label="Fim" required disabled={pending} />
        </div>
        <TextArea<BlockFormValues>
          name="reason"
          label="Motivo"
          placeholder="Ex.: Almoço, folga (opcional)"
          disabled={pending}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Criar bloqueio"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

interface BlockFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlockFormDialog({
  open,
  onOpenChange,
}: BlockFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bloquear horário</DialogTitle>
          <DialogDescription>
            O horário bloqueado não aceita agendamento e aparece destacado na
            Agenda.
          </DialogDescription>
        </DialogHeader>
        <BlockForm
          key={String(open)}
          formId="block-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
