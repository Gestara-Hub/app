"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Código técnico discreto: fonte mono pequena, quebra de linha e botão de copiar. */
export function CopyCode({ value, label = "Código" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sem permissão da área de transferência: o código continua visível para selecionar.
    }
  };
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <code className="min-w-0 break-all font-mono text-[11px]">{value}</code>
      <Button type="button" variant="ghost" size="icon-xs" onClick={copy} aria-label={copied ? "Código copiado" : `Copiar ${label.toLowerCase()}`}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </span>
  );
}
