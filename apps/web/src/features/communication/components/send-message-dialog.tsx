"use client";

import { useState } from "react";
import { formatPhone } from "@gestarahub/core/format";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSendMessage, useWhatsAppSession } from "../hooks/use-communication";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipientName?: string;
  defaultRecipientPhone?: string;
  defaultContent?: string;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  defaultRecipientName = "",
  defaultRecipientPhone = "",
  defaultContent = "",
}: SendMessageDialogProps) {
  const { data: session } = useWhatsAppSession();
  const sendMutation = useSendMessage();

  const [name, setName] = useState(defaultRecipientName);
  const [phone, setPhone] = useState(defaultRecipientPhone);
  const [content, setContent] = useState(defaultContent);

  const isConnected = session?.status === "connected";

  const handleSend = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do destinatário.");
      return;
    }

    if (!phone.replace(/\D/g, "")) {
      toast.error("Informe o número de WhatsApp com DDD.");
      return;
    }

    if (!content.trim()) {
      toast.error("Digite o texto da mensagem antes de enviar.");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        recipientName: name.trim(),
        recipientPhone: phone.replace(/\D/g, ""),
        content: content.trim(),
        trigger: "manual_broadcast",
      });

      toast.success(`Disparo realizado com sucesso para ${name}.`);

      setName("");
      setPhone("");
      setContent("");
      onOpenChange(false);
    } catch {
      toast.error("Falha no envio. Verifique a conexão do WhatsApp e tente novamente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            <DialogTitle>Enviar Mensagem Direta</DialogTitle>
          </div>
          <DialogDescription>
            Envie uma mensagem instantânea via WhatsApp oficial conectado.
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 p-4 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-medium">WhatsApp Desconectado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conecte sua instância na aba &quot;Conexão WhatsApp&quot; antes de realizar envios.
            </p>
          </div>
        ) : null}

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipient-name">Nome do Aluno / Cliente</Label>
              <Input
                id="recipient-name"
                placeholder="Ex: Carlos Eduardo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipient-phone">WhatsApp (com DDD)</Label>
              <Input
                id="recipient-phone"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message-text">Conteúdo da Mensagem</Label>
            <Textarea
              id="message-text"
              rows={4}
              placeholder="Olá! Passando para te avisar que..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!isConnected || sendMutation.isPending}
            className="gap-2"
          >
            <Send className="size-4" />
            {sendMutation.isPending ? "Enviando..." : "Disparar Mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
