"use client";

import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { unwrap } from "@/services/server/action";
import { sendTestWhatsAppMessageAction } from "@/services/communication/whatsappTestActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputPhone, InputText, SegmentedChoiceField } from "@/components/form";
import { getErrorMessage } from "@gestarahub/core/api-error";

interface TestWhatsAppDialogProps {
  connectedPhone?: string;
}

interface TestValues {
  /** E.164, como o resto do sistema (`InputPhone`). */
  to: string;
  type: "template" | "text";
  messageText: string;
}

const DEFAULTS: TestValues = { to: "", type: "template", messageText: "" };

const TYPE_OPTIONS = [
  {
    value: "template",
    label: "Modelo aprovado",
    description: "Chega mesmo fora da janela de 24 horas.",
  },
  {
    value: "text",
    label: "Texto livre",
    description: "Só chega se a pessoa escreveu nas últimas 24 horas.",
  },
];

/** Mesmo numero do espaco (ou com os mesmos 8 ultimos digitos): o WhatsApp nao envia para si mesmo. */
function sameAsConnected(to: string, connected?: string): boolean {
  const digitsTo = to.replace(/\D/g, "");
  const digitsConnected = (connected ?? "").replace(/\D/g, "");
  if (!digitsConnected) return false;
  return digitsTo === digitsConnected || (digitsConnected.length >= 8 && digitsTo.endsWith(digitsConnected.slice(-8)));
}

/** Ferramenta de desenvolvimento: envio real pela API oficial (fora do build de producao). */
export function TestWhatsAppDialog({ connectedPhone }: TestWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const form = useForm<TestValues>({ defaultValues: DEFAULTS });
  const type = useWatch({ control: form.control, name: "type" });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(DEFAULTS);
  }

  async function onSubmit(values: TestValues) {
    if (!values.to.replace(/\D/g, "")) {
      form.setError("to", { message: "Informe o celular que vai receber o teste." });
      return;
    }
    if (sameAsConnected(values.to, connectedPhone)) {
      form.setError("to", { message: "Use outro celular: o WhatsApp não envia para o próprio número do espaço." });
      return;
    }
    if (values.type === "text" && !values.messageText.trim()) {
      form.setError("messageText", { message: "Escreva o texto do teste." });
      return;
    }

    setIsSending(true);
    try {
      const res = await unwrap(
        sendTestWhatsAppMessageAction({ to: values.to, type: values.type, messageText: values.messageText }),
      );
      toast.success(res.details);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Falha ao enviar mensagem de teste."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send className="size-4" />
          Testar envio real
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden" noValidate>
            <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                Enviar mensagem de teste
              </DialogTitle>
              <DialogDescription>Uma mensagem real pela API oficial do WhatsApp.</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <InputPhone<TestValues>
                name="to"
                label="Celular que vai receber"
                hint="Outro aparelho: o WhatsApp não envia para o próprio número do espaço."
                required
                disabled={isSending}
              />
              <SegmentedChoiceField<TestValues>
                name="type"
                options={TYPE_OPTIONS}
                ariaLabel="Tipo de mensagem"
                variant="cards"
                disabled={isSending}
              />
              {type === "text" ? (
                <InputText<TestValues>
                  name="messageText"
                  label="Texto da mensagem"
                  placeholder="Escreva o texto do teste"
                  required
                  disabled={isSending}
                />
              ) : null}
            </DialogBody>

            <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4" saving={isSending}>
              <Button type="button" variant="outline" disabled={isSending} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? "Enviando..." : "Enviar teste"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
