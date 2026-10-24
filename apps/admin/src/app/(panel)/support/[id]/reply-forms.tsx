"use client";

import { FormProvider } from "react-hook-form";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { replySchema, threadNoteSchema } from "@/lib/form-schemas";
import { noteAction, replyAction, type SupportFormState } from "../actions";

export function ReplyForm({ threadId, macros }: { threadId: string; macros: { id: string; title: string; body: string }[]; disabled: boolean }) {
  const { form, state, pending, submit } = useActionForm<typeof replySchema, SupportFormState>({
    schema: replySchema,
    defaultValues: { threadId, body: "" },
    action: replyAction,
    resetOnSuccess: true,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Responder ao cliente</CardTitle>
        <CardDescription>A resposta aparece no Fale com a gente do cliente e vai por e-mail.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-3" noValidate>
            {macros.length > 0 ? (
              <div className="space-y-1.5">
                <label htmlFor="macro" className="text-sm font-medium">
                  Resposta pronta
                </label>
                <select
                  id="macro"
                  className="h-9 w-full rounded-md border bg-background px-3 text-base md:text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    const macro = macros.find((m) => m.id === event.target.value);
                    if (macro) form.setValue("body", macro.body, { shouldDirty: true, shouldValidate: true });
                    event.target.value = "";
                  }}
                >
                  <option value="">Escolher uma resposta pronta...</option>
                  {macros.map((macro) => (
                    <option key={macro.id} value={macro.id}>
                      {macro.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <TextArea name="body" label="Mensagem" rows={6} maxLength={4000} />
            <FormFeedback state={state} okText="Resposta enviada." />
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando..." : "Enviar resposta"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

export function NoteForm({ threadId }: { threadId: string }) {
  const { form, state, pending, submit } = useActionForm<typeof threadNoteSchema, SupportFormState>({
    schema: threadNoteSchema,
    defaultValues: { threadId, body: "" },
    action: noteAction,
    resetOnSuccess: true,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nota interna</CardTitle>
        <CardDescription>Só o painel vê. O cliente nunca recebe.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-3" noValidate>
            <TextArea name="body" rows={3} maxLength={4000} ariaLabel="Nota interna" />
            <FormFeedback state={state} />
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Salvando..." : "Salvar nota"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
