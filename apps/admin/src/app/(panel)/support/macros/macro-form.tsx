"use client";

import { FormProvider } from "react-hook-form";
import { FormFeedback, InputText, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { macroSchema } from "@/lib/form-schemas";
import { saveMacroAction, type SupportFormState } from "../actions";

export function MacroForm({ macro }: { macro?: { id: string; title: string; body: string } }) {
  const { form, state, pending, submit } = useActionForm<typeof macroSchema, SupportFormState>({
    schema: macroSchema,
    defaultValues: { id: macro?.id, title: macro?.title ?? "", body: macro?.body ?? "" },
    action: saveMacroAction,
    resetOnSuccess: !macro,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="space-y-3" noValidate>
        <InputText name="title" placeholder="Título" ariaLabel="Título" maxLength={80} />
        <TextArea name="body" rows={5} placeholder="Texto da resposta" ariaLabel="Texto da resposta" maxLength={4000} />
        <FormFeedback state={state} okText="Salvo." />
        <Button type="submit" variant={macro ? "outline" : "default"} disabled={pending}>
          {pending ? "Salvando..." : macro ? "Salvar" : "Adicionar"}
        </Button>
      </form>
    </FormProvider>
  );
}
