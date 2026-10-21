"use client";

import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { formatPhone } from "@gestarahub/core/format";
import { ComboboxField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH, whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import { useMessageRecipients, useMessageSuggestions, useWhatsAppSend } from "../hooks/use-communication";
import type { MessageSuggestion } from "../message-suggestions";

const schema = z.object({
  clientId: z.string({ error: "Selecione o aluno." }).min(1, "Selecione o aluno."),
  content: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem.")
    .refine((v) => charCount(v) <= MESSAGE_MAX_LENGTH, `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.`),
});
type FormValues = z.infer<typeof schema>;

/** Aluno fixo (ficha do aluno): o campo de aluno nao aparece. */
export interface MessageRecipient {
  id: string;
  name: string;
  phone?: string;
}

function SendMessageForm({ onDone, fixed }: { onDone: () => void; fixed?: MessageRecipient }) {
  const { data: activeClients = [] } = useMessageRecipients();
  const clients: MessageRecipient[] = fixed ? [fixed] : activeClients;
  const whatsapp = useWhatsAppSend();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientId: fixed?.id ?? "", content: "" },
  });
  const clientId = useWatch({ control: form.control, name: "clientId" });
  const contentLength = charCount(useWatch({ control: form.control, name: "content" }) ?? "");
  const recipient = clients.find((c) => c.id === clientId);
  const noPhone = Boolean(recipient && !whatsappNumber(recipient.phone));
  const suggestions = useMessageSuggestions(recipient?.id);
  // Modelo escolhido (o envio leva o tipo dele e a cobranca ligada).
  const [chosen, setChosen] = useState<MessageSuggestion | null>(null);
  // Texto que o modelo montou: trocar o aluno com ele intacto limpa o campo.
  const chosenText = useRef<string | null>(null);

  useEffect(
    () =>
      form.subscribe({
        name: ["clientId", "content"],
        formState: { values: true },
        callback: ({ values, name }) => {
          const switchedStudent = name === "clientId";
          if (!switchedStudent && values.content?.trim()) return;
          if (switchedStudent && chosenText.current !== null && values.content === chosenText.current) {
            form.setValue("content", "");
          }
          // Campo apagado ou outro aluno: volta a ser mensagem avulsa.
          chosenText.current = null;
          setChosen(null);
        },
      }),
    [form],
  );

  // So os modelos que existem (o texto sai do modelo salvo em Comunicacao).
  const templates = recipient
    ? suggestions.flatMap((suggestion) => {
        const text = whatsapp.compose(suggestion.trigger, suggestion.values, recipient.name);
        return text ? [{ suggestion, text }] : [];
      })
    : [];

  function applyTemplate(item: { suggestion: MessageSuggestion; text: string }) {
    form.setValue("content", item.text, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    chosenText.current = item.text;
    setChosen(item.suggestion);
    // No toque, sem foco automatico (o teclado cobriria a tela).
    if (!window.matchMedia("(pointer: coarse)").matches) form.setFocus("content");
  }

  const options = clients.map((c) => ({
    value: c.id,
    label: c.phone ? `${c.name} · ${formatPhone(c.phone)}` : `${c.name} · sem telefone`,
  }));

  const onSubmit = form.handleSubmit((values) => {
    const client = clients.find((c) => c.id === values.clientId);
    if (!client) return;
    if (!whatsappNumber(client.phone)) {
      form.setError("clientId", { message: "Este aluno não tem WhatsApp com DDD no cadastro." });
      return;
    }
    whatsapp.send({
      trigger: chosen?.trigger ?? "manual_broadcast",
      recipient: { name: client.name, phone: client.phone, clientId: client.id },
      content: values.content,
      chargeId: chosen?.chargeId,
      reviewed: true,
    });
    onDone();
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {fixed ? (
            noPhone ? (
              <p className="text-sm text-destructive">Este aluno não tem WhatsApp com DDD no cadastro.</p>
            ) : null
          ) : (
            <ComboboxField<FormValues>
              name="clientId"
              label="Aluno"
              placeholder="Selecione o aluno"
              searchPlaceholder="Buscar aluno..."
              emptyMessage="Nenhum aluno encontrado."
              options={options}
              required
              hint={noPhone ? "Este aluno não tem WhatsApp com DDD no cadastro." : undefined}
            />
          )}
          <div className="space-y-1">
            <TextArea<FormValues>
              name="content"
              label="Mensagem"
              placeholder="Escreva a mensagem ou use um modelo"
              rows={5}
              required
            />
            {/* Contador como a pessoa ve: emoji conta 1 (ALU-38). */}
            <p
              className={cn(
                "text-right text-[11px] tabular-nums",
                contentLength > MESSAGE_MAX_LENGTH ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {contentLength} de {MESSAGE_MAX_LENGTH}
            </p>
          </div>
          {templates.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Modelos</p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((item) => {
                  const active = chosen?.key === item.suggestion.key;
                  return (
                    <button
                      key={item.suggestion.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyTemplate(item)}
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 font-medium text-foreground"
                          : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                      {item.suggestion.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" disabled={noPhone || whatsapp.isSending}>
            {whatsapp.mode === "official" ? (whatsapp.isSending ? "Enviando..." : "Enviar") : "Abrir no WhatsApp"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

/** Mensagem avulsa para um aluno, pelo WhatsApp do proprio espaco. */
export function SendMessageDialog({
  open,
  onOpenChange,
  recipient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aluno fixo (ficha do aluno). */
  recipient?: MessageRecipient;
}) {
  const whatsapp = useWhatsAppSend();
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {recipient ? `Mensagem para ${recipient.name}` : "Nova mensagem"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {whatsapp.mode === "official"
              ? "Sai pelo WhatsApp oficial do espaço."
              : "Abre o WhatsApp deste aparelho com a mensagem pronta."}
          </SheetDescription>
        </SheetHeader>
        {present ? <SendMessageForm onDone={() => onOpenChange(false)} fixed={recipient} /> : null}
      </SheetContent>
    </Sheet>
  );
}

export const SendMessageDrawer = SendMessageDialog;
