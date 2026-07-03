"use client";

import {
  useForm,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ComboboxField, FieldShell, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
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
        <Controller
          control={form.control}
          name="date"
          render={({ field, fieldState }) => (
            <FieldShell id="blk-date" label="Data" required error={fieldState.error?.message}>
              <Input
                id="blk-date"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="start"
            render={({ field, fieldState }) => (
              <FieldShell id="blk-start" label="Início" required error={fieldState.error?.message}>
                <Input
                  id="blk-start"
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
          <Controller
            control={form.control}
            name="end"
            render={({ field, fieldState }) => (
              <FieldShell id="blk-end" label="Fim" required error={fieldState.error?.message}>
                <Input
                  id="blk-end"
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
