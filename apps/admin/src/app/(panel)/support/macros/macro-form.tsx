"use client";

import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { FormFeedback, InputText, TextArea, useActionForm } from "@/components/form";
import { DrawerBody, DrawerFooter, useDrawerClose } from "@/components/shared/form-drawer";
import { macroSchema } from "@/lib/form-schemas";
import { saveMacroAction, type SupportFormState } from "../actions";

/** Formulário da resposta pronta, dentro de uma gaveta (`FormDrawer`). */
export function MacroForm({ macro }: { macro?: { id: string; title: string; body: string } }) {
  const close = useDrawerClose();
  const { form, state, pending, submit } = useActionForm<typeof macroSchema, SupportFormState>({
    schema: macroSchema,
    defaultValues: { id: macro?.id, title: macro?.title ?? "", body: macro?.body ?? "" },
    action: saveMacroAction,
    resetOnSuccess: !macro,
    onSuccess: () => {
      toast.success(macro ? "Resposta pronta salva." : "Resposta pronta adicionada.");
      close();
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <InputText name="title" label="Título" required placeholder="Informe o título" maxLength={80} />
          <TextArea name="body" label="Texto da resposta" required rows={8} placeholder="Escreva o texto da resposta" maxLength={4000} />
          <FormFeedback state={state} />
        </DrawerBody>
        <DrawerFooter submitLabel={macro ? "Salvar" : "Adicionar"} pending={pending} />
      </form>
    </FormProvider>
  );
}
