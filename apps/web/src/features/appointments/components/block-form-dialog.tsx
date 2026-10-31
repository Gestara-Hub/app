"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { ComboboxField, DateField, TextArea, TimeField } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import type { CreateTimeBlock } from "@gestarahub/contracts";
import { useProfessionals } from "@/features/professionals";
import { useCreateTimeBlock } from "../hooks/use-time-blocks";
import { blockFormSchema, type BlockFormValues } from "../block-schema";

function BlockForm({
  formId,
  onSuccess,
  onCancel,
}: {
  formId: string;
  onSuccess: () => void;
  onCancel?: () => void;
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
      <form id={formId} onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
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
        </DialogBody>
        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
          {onCancel ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              Cancelar
            </Button>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Adicionar"}
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Bloquear horário</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            O horário bloqueado não aceita agendamento e aparece destacado na Agenda.
          </SheetDescription>
        </SheetHeader>
        <BlockForm
          key={String(open)}
          formId="block-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
