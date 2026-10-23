"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Salvar comprovante": o PDF gerado no servidor (layout dos documentos), que
 * o navegador abre e deixa salvar. Vale para todo pagamento, com ou sem o
 * comprovante do parceiro.
 */
export function SaveReceiptButton({ code }: { code: string }) {
  return (
    <Button asChild className="w-full gap-2 print:hidden">
      <a href={`/p/${encodeURIComponent(code)}/comprovante`} target="_blank" rel="noopener noreferrer">
        <Download className="size-4" aria-hidden />
        Salvar comprovante
      </a>
    </Button>
  );
}

/** Copia o codigo do pagamento (referencia para falar com o espaco). */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      aria-label={copied ? "Código copiado" : "Copiar código do pagamento"}
      title={copied ? "Código copiado" : "Copiar código"}
      className="-my-1 text-muted-foreground print:hidden"
    >
      {copied ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
