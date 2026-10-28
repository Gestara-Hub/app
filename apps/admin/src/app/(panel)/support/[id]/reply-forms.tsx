"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { replySchema, threadNoteSchema } from "@/lib/form-schemas";
import { cn } from "@/lib/utils";
import { noteAction, replyAction, type SupportFormState } from "../actions";

type Macro = { id: string; title: string; body: string };

/** Caixa fixa no pé da tela: as mensagens rolam por trás; resposta e nota interna em abas. */
export function Composer({ threadId, macros }: { threadId: string; macros: Macro[] }) {
  const [tab, setTab] = useState<"reply" | "note">("reply");
  return (
    <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-background from-70% to-transparent px-1 pb-3 pt-6">
      <div className={cn("rounded-xl border bg-card shadow-lg", tab === "note" && "border-warning/50")}>
        <div role="tablist" className="flex gap-1 border-b px-2 pt-2">
          {(
            [
              ["reply", "Responder ao cliente"],
              ["note", "Nota interna"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-1.5 text-sm font-medium",
                tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3">
          <div className={tab === "reply" ? "" : "hidden"}>
            <ReplyForm threadId={threadId} macros={macros} />
          </div>
          <div className={tab === "note" ? "" : "hidden"}>
            <NoteForm threadId={threadId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplyForm({ threadId, macros }: { threadId: string; macros: Macro[] }) {
  const { form, state, pending, submit } = useActionForm<typeof replySchema, SupportFormState>({
    schema: replySchema,
    defaultValues: { threadId, body: "" },
    action: replyAction,
    resetOnSuccess: true,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="space-y-2" noValidate>
        <TextArea name="body" rows={3} maxLength={4000} ariaLabel="Mensagem para o cliente" placeholder="Escreva a resposta ao cliente. Ela vai por e-mail também." inputClassName="max-h-48 resize-none" />
        <FormFeedback state={state} okText="Resposta enviada." />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {macros.length > 0 ? (
            <Select
              value=""
              onValueChange={(id) => {
                const macro = macros.find((m) => m.id === id);
                if (macro) form.setValue("body", macro.body, { shouldDirty: true, shouldValidate: true });
              }}
            >
              <SelectTrigger aria-label="Resposta pronta" className="min-w-0 max-w-[60%] sm:w-56">
                <SelectValue placeholder="Inserir resposta pronta" />
              </SelectTrigger>
              <SelectContent>
                {macros.map((macro) => (
                  <SelectItem key={macro.id} value={macro.id}>
                    {macro.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando..." : "Enviar resposta"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function NoteForm({ threadId }: { threadId: string }) {
  const { form, state, pending, submit } = useActionForm<typeof threadNoteSchema, SupportFormState>({
    schema: threadNoteSchema,
    defaultValues: { threadId, body: "" },
    action: noteAction,
    resetOnSuccess: true,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="space-y-2" noValidate>
        <TextArea name="body" rows={3} maxLength={4000} ariaLabel="Nota interna" placeholder="Só o painel vê. O cliente nunca recebe." inputClassName="max-h-48 resize-none" />
        <FormFeedback state={state} />
        <div className="flex justify-end">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Salvando..." : "Salvar nota"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
