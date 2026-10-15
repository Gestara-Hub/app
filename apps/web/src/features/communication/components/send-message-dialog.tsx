"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatPhone } from "@gestarahub/core/format";
import { ComboboxField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappNumber } from "@/lib/whatsapp";
import { useMessageRecipients, useWhatsAppSend } from "../hooks/use-communication";

const schema = z.object({
  clientId: z.string({ error: "Selecione o aluno." }).min(1, "Selecione o aluno."),
  content: z.string().trim().min(1, "Escreva a mensagem.").max(1000, "Use no máximo 1000 caracteres."),
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
  const recipient = clients.find((c) => c.id === clientId);
  const noPhone = Boolean(recipient && !whatsappNumber(recipient.phone));

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
      trigger: "manual_broadcast",
      recipient: { name: client.name, phone: client.phone, clientId: client.id },
      content: values.content,
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
          <TextArea<FormValues>
            name="content"
            label="Mensagem"
            placeholder="Escreva a mensagem para o aluno"
            rows={5}
            required
          />
        </DialogBody>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 px-6 py-4">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" disabled={noPhone || whatsapp.isSending}>
            {whatsapp.mode === "official" ? (whatsapp.isSending ? "Enviando..." : "Enviar") : "Abrir no WhatsApp"}
          </Button>
        </div>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>{recipient ? `Mensagem para ${recipient.name}` : "Nova mensagem"}</DialogTitle>
          <DialogDescription>
            {whatsapp.mode === "official"
              ? "Sai pelo WhatsApp oficial do espaço."
              : "Abre o WhatsApp deste aparelho com a mensagem pronta."}
          </DialogDescription>
        </DialogHeader>
        {open ? <SendMessageForm onDone={() => onOpenChange(false)} fixed={recipient} /> : null}
      </DialogContent>
    </Dialog>
  );
}
