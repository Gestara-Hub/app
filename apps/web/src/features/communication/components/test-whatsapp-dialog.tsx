"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { unwrap } from "@/services/server/action";
import { sendTestWhatsAppMessageAction } from "@/services/communication/whatsappTestActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@gestarahub/core/api-error";

interface TestWhatsAppDialogProps {
  connectedPhone?: string;
  defaultPhone?: string;
}

export function TestWhatsAppDialog({ connectedPhone, defaultPhone }: TestWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone || "");
  const [type, setType] = useState<"template" | "text">("template");
  const [customText, setCustomText] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    const rawTo = phone.trim();
    if (!rawTo) {
      toast.error("Informe o número de telefone com DDD.");
      return;
    }

    const digitsTo = rawTo.replace(/\D/g, "");
    const digitsConnected = (connectedPhone ?? "").replace(/\D/g, "");
    if (digitsConnected && (digitsTo === digitsConnected || (digitsConnected.length >= 8 && digitsTo.endsWith(digitsConnected.slice(-8))))) {
      toast.error("O número de destino não pode ser o mesmo do espaço conectado. Digite o número de outro celular para receber o teste.");
      return;
    }

    setIsSending(true);
    try {
      const res = await unwrap(
        sendTestWhatsAppMessageAction({
          to: phone,
          type,
          messageText: customText,
        }),
      );
      toast.success(res.details);
      setOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Falha ao enviar mensagem de teste."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send className="size-3.5" />
          Testar envio real
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
            Enviar mensagem de teste
          </DialogTitle>
          <DialogDescription className="text-xs">
            Dispare uma mensagem real para validar a comunicação entre o GestaraHub e a API oficial do WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="test-phone" className="text-xs font-medium">
              Número de destino (com DDD)
            </Label>
            <Input
              id="test-phone"
              placeholder="Ex: (92) 99184-4219 (celular pessoal)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-sm"
              disabled={isSending}
            />
            <p className="text-[11px] text-muted-foreground">
              Informe outro aparelho (seu celular pessoal com DDD). O WhatsApp não permite que o mesmo número envie mensagem para si mesmo.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de mensagem</Label>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  type === "template"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="messageType"
                  value="template"
                  checked={type === "template"}
                  onChange={() => setType("template")}
                  className="mt-1"
                  disabled={isSending}
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    Modelo aprovado da conta
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Boas-vindas aprovadas na Meta (ou hello_world na sandbox): chega mesmo fora da janela de 24 horas.
                  </div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  type === "text"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="messageType"
                  value="text"
                  checked={type === "text"}
                  onChange={() => setType("text")}
                  className="mt-1"
                  disabled={isSending}
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">Texto livre</div>
                  <div className="text-[11px] text-muted-foreground">
                    Exige que o destinatário tenha respondido ao número de teste nas últimas 24h.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {type === "text" && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-text" className="text-xs font-medium">
                Texto da mensagem
              </Label>
              <Input
                id="custom-text"
                placeholder="Digite a mensagem de teste..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="text-sm"
                disabled={isSending}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Enviando via Meta...
              </>
            ) : (
              "Disparar teste agora"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
