"use client";

import { useEffect, useState } from "react";
import { FormProvider } from "react-hook-form";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { replySchema, threadNoteSchema } from "@/lib/form-schemas";
import { cn } from "@/lib/utils";
import { noteAction, replyAction, type SupportFormState } from "../actions";

type Macro = { id: string; title: string; body: string };

/** Leva a tela ao fim da conversa ao abrir e quando chega mensagem nova. */
export function ScrollToEnd({ count }: { count: number }) {
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [count]);
  return null;
}

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
        <div className="flex items-center justify-between gap-2">
          {macros.length > 0 ? (
            <select
              aria-label="Resposta pronta"
              className="h-9 min-w-0 max-w-[60%] rounded-md border bg-background px-3 text-base md:text-sm"
              defaultValue=""
              onChange={(event) => {
                const macro = macros.find((m) => m.id === event.target.value);
                if (macro) form.setValue("body", macro.body, { shouldDirty: true, shouldValidate: true });
                event.target.value = "";
              }}
            >
              <option value="">Resposta pronta...</option>
              {macros.map((macro) => (
                <option key={macro.id} value={macro.id}>
                  {macro.title}
                </option>
              ))}
            </select>
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
