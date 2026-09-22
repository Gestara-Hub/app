"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { InputText, SwitchField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import type { Category, CreateCategory } from "@gestarahub/contracts";
import { useCreateCategory, useUpdateCategory } from "@/features/categories";
import { modalityFormSchema, type ModalityFormValues } from "../modality-schema";

function toDefaults(modality?: Category): ModalityFormValues {
  return {
    name: modality?.name ?? "",
    active: modality ? modality.status === "active" : true,
  };
}

interface ModalityFormProps {
  modality?: Category;
  onSuccess: () => void;
  formId: string;
}

export function ModalityForm({ modality, onSuccess, formId }: ModalityFormProps) {
  const isEdit = Boolean(modality);
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<ModalityFormValues>({
    resolver: zodResolver(modalityFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(modality),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && modality) {
        await updateMut.mutateAsync({
          id: modality.id,
          payload: {
            name: values.name,
            status: values.active ? "active" : "inactive",
          },
        });
        toast.success("Modalidade atualizada com sucesso.");
      } else {
        const payload: CreateCategory = { name: values.name };
        await createMut.mutateAsync(payload);
        toast.success("Modalidade criada com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<ModalityFormValues>, {
            message: f.message,
          });
        }
      } else {
        toast.error(
          getErrorMessage(error, "Não foi possível salvar a modalidade."),
        );
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
          <InputText<ModalityFormValues>
            name="name"
            label="Nome da modalidade / curso"
            placeholder="Ex.: Inglês, Dança, Natação"
            hint="O tipo de aula, curso ou modalidade que a unidade oferece. As turmas e os professores se organizam por ela."
            required
            disabled={pending}
          />

          {isEdit ? (
            <SwitchField<ModalityFormValues>
              name="active"
              label="Modalidade ativa"
              hint="Modalidades inativas não aparecem em novas turmas nem no cadastro de instrutores."
              disabled={pending}
            />
          ) : null}
        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
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
                : "Criar modalidade"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
