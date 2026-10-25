"use client";

import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { DrawerBody, DrawerFooter, FormDrawer, useDrawerClose } from "@/components/shared/form-drawer";
import { Button } from "@/components/ui/button";
import { spaceNoteSchema } from "@/lib/form-schemas";
import { addNoteAction, type SpaceFormState } from "./actions";

/** "Nova anotação": botão no cabeçalho da seção que abre a gaveta do formulário. */
export function NoteForm({ spaceId }: { spaceId: string }) {
  return (
    <FormDrawer title="Nova anotação" description="Anotação interna sobre este espaço. O cliente nunca vê." trigger={<Button>Nova anotação</Button>}>
      <NoteDrawerForm spaceId={spaceId} />
    </FormDrawer>
  );
}

function NoteDrawerForm({ spaceId }: { spaceId: string }) {
  const close = useDrawerClose();
  const { form, state, pending, submit } = useActionForm<typeof spaceNoteSchema, SpaceFormState>({
    schema: spaceNoteSchema,
    defaultValues: { spaceId, body: "" },
    action: addNoteAction,
    onSuccess: () => {
      toast.success("Anotação adicionada.");
      close();
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <TextArea name="body" label="Anotação" required rows={6} maxLength={2000} placeholder="Escreva o que a equipe precisa saber" />
          <FormFeedback state={state} />
        </DrawerBody>
        <DrawerFooter submitLabel="Adicionar" pending={pending} />
      </form>
    </FormProvider>
  );
}
