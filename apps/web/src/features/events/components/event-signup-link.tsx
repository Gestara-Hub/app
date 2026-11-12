"use client";

import { useState } from "react";
import { Copy, Download, Link2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { EventView } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { whatsappShareLink } from "@/lib/whatsapp";
import { datesLabel } from "../event-copy";

/** Endereco publico da inscricao (`/p/e/<codigo>`). */
export function eventSignupUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/p/e/${code}`;
}

/**
 * Divulgacao da inscricao pelo link (doc product/29 P14): copiar, mandar pelo
 * WhatsApp com o texto pronto e o QR code para o cartaz (imagem para baixar).
 */
export function EventSignupLink({ event }: { event: EventView }) {
  const [qrOpen, setQrOpen] = useState(false);
  const code = event.publicSignup?.code;
  if (!event.publicSignup?.enabled || !code) return null;
  const url = eventSignupUrl(code);
  const message = `Inscrições abertas: ${event.name} (${datesLabel(event)}). Faça a sua por aqui: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  };

  const download = async () => {
    // Biblioteca carregada so aqui: o QR em alta resolucao para imprimir.
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M" });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `inscricao-${event.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
    link.click();
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Inscrições pelo link abertas</p>
          <p className="min-w-0 break-all text-xs text-muted-foreground">{url}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => void copy()}>
          <Copy className="size-4" />
          Copiar link
        </Button>
        <Button variant="outline" asChild>
          <a href={whatsappShareLink(message)} target="_blank" rel="noopener noreferrer">
            Enviar pelo WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={() => setQrOpen(true)}>
          <QrCode className="size-4" />
          QR code
        </Button>
      </div>
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="shrink-0">
            <DialogTitle>QR code da inscrição</DialogTitle>
            <DialogDescription>Para o cartaz: a câmera do celular abre a página de inscrição.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="mx-auto w-56 rounded-lg bg-white p-3">
              <QRCodeSVG value={url} level="M" marginSize={0} className="h-auto w-full" role="img" aria-label="QR code da inscrição" />
            </div>
            <Button className="w-full" onClick={() => void download()}>
              <Download className="size-4" />
              Baixar imagem
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
