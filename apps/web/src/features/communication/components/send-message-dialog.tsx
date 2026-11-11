"use client";

import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { formatPhone, plural } from "@gestarahub/core/format";
import { MultiSelectField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH, personalizeMessage, whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import { useOrganization } from "@/features/settings";
import {
  useMessageRecipients,
  useMessageSuggestions,
  useWhatsAppSend,
} from "../hooks/use-communication";
import type { ReminderGroup } from "../reminders";
import { ReminderSequenceDialog } from "./reminder-sequence-dialog";
import type { MessageSuggestion } from "../message-suggestions";

const schema = z.object({
  clientIds: z.array(z.string()).min(1, "Selecione ao menos um aluno."),
  content: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem.")
    .refine(
      (v) => charCount(v) <= MESSAGE_MAX_LENGTH,
      `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.`,
    ),
});
type FormValues = z.infer<typeof schema>;

/** Aluno fixo (ficha do aluno): o campo de aluno nao aparece. */
export interface MessageRecipient {
  id: string;
  name: string;
  phone?: string;
}

function SendMessageForm({
  onDone,
  onSequence,
  fixed,
}: {
  onDone: () => void;
  /** Varios alunos: o envio segue em sequencia (um toque por aluno), fora desta janela. */
  onSequence: (group: ReminderGroup) => void;
  fixed?: MessageRecipient;
}) {
  const { data: activeClients = [] } = useMessageRecipients();
  const clients: MessageRecipient[] = fixed ? [fixed] : activeClients;
  const whatsapp = useWhatsAppSend();
  const { data: organization } = useOrganization();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientIds: fixed ? [fixed.id] : [], content: "" },
  });
  const clientIds =
    useWatch({ control: form.control, name: "clientIds" }) ?? [];
  const contentLength = charCount(
    useWatch({ control: form.control, name: "content" }) ?? "",
  );
  const picked = clients.filter((c) => clientIds.includes(c.id));
  // Modelos e sugestoes valem para um aluno so; com varios, a mensagem e a mesma para todos.
  const recipient = picked.length === 1 ? picked[0] : undefined;
  const many = picked.length > 1;
  const noPhone = Boolean(recipient && !whatsappNumber(recipient.phone));
  const withoutPhone = picked.filter((c) => !whatsappNumber(c.phone)).length;
  const suggestions = useMessageSuggestions(recipient?.id);
  // Modelo escolhido (o envio leva o tipo dele e a cobranca ligada).
  const [chosen, setChosen] = useState<MessageSuggestion | null>(null);
  // Texto que o modelo montou: trocar o aluno com ele intacto limpa o campo.
  const chosenText = useRef<string | null>(null);

  useEffect(
    () =>
      form.subscribe({
        name: ["clientIds", "content"],
        formState: { values: true },
        callback: ({ values, name }) => {
          const switchedStudent = name === "clientIds";
          if (!switchedStudent && values.content?.trim()) return;
          if (
            switchedStudent &&
            chosenText.current !== null &&
            values.content === chosenText.current
          ) {
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
        const text = whatsapp.compose(
          suggestion.trigger,
          suggestion.values,
          recipient.name,
        );
        return text ? [{ suggestion, text }] : [];
      })
    : [];

  function applyTemplate(item: {
    suggestion: MessageSuggestion;
    text: string;
  }) {
    form.setValue("content", item.text, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    chosenText.current = item.text;
    setChosen(item.suggestion);
    // No toque, sem foco automatico (o teclado cobriria a tela).
    if (!window.matchMedia("(pointer: coarse)").matches)
      form.setFocus("content");
  }

  const options = clients.map((c) => ({
    value: c.id,
    label: c.phone
      ? `${c.name} · ${formatPhone(c.phone)}`
      : `${c.name} · sem telefone`,
  }));

  const onSubmit = form.handleSubmit((values) => {
    const chosenClients = clients.filter((c) =>
      values.clientIds.includes(c.id),
    );
    if (chosenClients.length === 0) return;
    if (chosenClients.length > 1) {
      // Em sequencia: um toque por aluno (o navegador nao abre varias abas sozinho).
      onSequence({
        key: "broadcast",
        category: "notice",
        level: "info",
        title: `Mensagem para ${plural(chosenClients.length, "aluno", "alunos")}`,
        detail: "Mensagem avulsa",
        items: chosenClients.map((c) => ({
          key: `broadcast:${c.id}`,
          studentId: c.id,
          studentName: c.name,
          ...(c.phone ? { phone: c.phone } : {}),
          trigger: "manual_broadcast" as const,
          values: {},
          content: personalizeMessage(
            values.content,
            c.name,
            organization?.name,
          ),
          detail: c.phone ? formatPhone(c.phone) : "Sem telefone",
        })),
        hidden: 0,
        pending: chosenClients.length,
      });
      onDone();
      return;
    }
    const client = chosenClients[0];
    if (!whatsappNumber(client.phone)) {
      form.setError("clientIds", {
        message: "Este aluno não tem WhatsApp com DDD no cadastro.",
      });
      return;
    }
    whatsapp.send({
      trigger: chosen?.trigger ?? "manual_broadcast",
      recipient: {
        name: client.name,
        phone: client.phone,
        clientId: client.id,
      },
      content: personalizeMessage(
        values.content,
        client.name,
        organization?.name,
      ),
      chargeId: chosen?.chargeId,
      reviewed: true,
    });
    onDone();
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DialogBody className="space-y-4">
          {fixed ? (
            noPhone ? (
              <p className="text-sm text-destructive">
                Este aluno não tem WhatsApp com DDD no cadastro.
              </p>
            ) : null
          ) : (
            <div className="space-y-1.5">
              <MultiSelectField<FormValues>
                name="clientIds"
                label="Alunos"
                placeholder="Selecione um ou mais alunos"
                searchPlaceholder="Buscar aluno..."
                emptyMessage="Nenhum aluno encontrado."
                options={options}
                maxVisible={3}
                required
                hint={
                  noPhone
                    ? "Este aluno não tem WhatsApp com DDD no cadastro."
                    : many && withoutPhone > 0
                      ? `${plural(withoutPhone, "aluno sem WhatsApp com DDD será pulado", "alunos sem WhatsApp com DDD serão pulados")}.`
                      : many
                        ? "A mensagem vai para cada aluno, em sequência. Use {aluno} para o nome."
                        : undefined
                }
              />
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() =>
                  form.setValue(
                    "clientIds",
                    clients
                      .filter((c) => whatsappNumber(c.phone))
                      .map((c) => c.id),
                    {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    },
                  )
                }
              >
                Selecionar todos com WhatsApp
              </Button>
            </div>
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
                contentLength > MESSAGE_MAX_LENGTH
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
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
            {many
              ? `Começar o envio (${picked.length})`
              : whatsapp.mode === "official"
                ? whatsapp.isSending
                  ? "Enviando..."
                  : "Enviar"
                : "Abrir no WhatsApp"}
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
  const [sequence, setSequence] = useState<ReminderGroup | null>(null);
  return (
    <>
      <ReminderSequenceDialog
        group={sequence}
        open={sequence !== null}
        onOpenChange={(next) => {
          if (!next) setSequence(null);
        }}
      />
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
          {present ? (
            <SendMessageForm
              onDone={() => onOpenChange(false)}
              onSequence={setSequence}
              fixed={recipient}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
