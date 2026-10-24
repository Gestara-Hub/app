"use client";

import { FormProvider } from "react-hook-form";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { spaceNoteSchema } from "@/lib/form-schemas";
import { addNoteAction, type SpaceFormState } from "./actions";

export function NoteForm({ spaceId }: { spaceId: string }) {
  const { form, state, pending, submit } = useActionForm<typeof spaceNoteSchema, SpaceFormState>({
    schema: spaceNoteSchema,
    defaultValues: { spaceId, body: "" },
    action: addNoteAction,
    resetOnSuccess: true,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="space-y-3" noValidate>
        <TextArea name="body" rows={3} maxLength={2000} placeholder="Anotação interna sobre este espaço (o cliente nunca vê)" ariaLabel="Anotação" />
        <FormFeedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Adicionar anotação"}
        </Button>
      </form>
    </FormProvider>
  );
}
