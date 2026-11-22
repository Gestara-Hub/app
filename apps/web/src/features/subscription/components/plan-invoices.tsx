"use client";

import { FileText } from "lucide-react";
import type { PlatformInvoiceStatus } from "@gestarahub/contracts";
import { formatCents, formatDate } from "@gestarahub/core/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlatformInvoices } from "../hooks/use-plan-change";

const STATUS: Record<PlatformInvoiceStatus, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  requesting: { label: "Em emissão", variant: "outline" },
  scheduled: { label: "Em emissão", variant: "outline" },
  synchronized: { label: "Em emissão", variant: "outline" },
  authorized: { label: "Emitida", variant: "secondary" },
  processing_cancellation: { label: "Cancelando", variant: "outline" },
  canceled: { label: "Cancelada", variant: "outline" },
  cancellation_denied: { label: "Emitida", variant: "secondary" },
  error: { label: "Em análise", variant: "outline" },
};

/**
 * Notas fiscais do Plano GestaraHub (doc technical/24 §7.1): uma por pagamento,
 * com PDF e XML quando emitida. Some enquanto nao houver nota. Recusa da
 * prefeitura aparece como "Em análise": a equipe e avisada e corrige.
 */
export function PlanInvoices() {
  const { data } = usePlatformInvoices();
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4 text-muted-foreground" aria-hidden />
        Notas fiscais
      </p>
      <ul className="divide-y rounded-lg border">
        {data.map((invoice) => {
          const status = STATUS[invoice.status];
          return (
            <li key={invoice.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm break-words">{invoice.serviceDescription}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatCents(invoice.amountCents)}</span>
                  <span>· {formatDate(invoice.effectiveDate ?? invoice.createdAt.slice(0, 10))}</span>
                  {invoice.invoiceNumber ? <span>· nº {invoice.invoiceNumber}</span> : null}
                  <Badge variant={status.variant}>{status.label}</Badge>
                </p>
              </div>
              {invoice.pdfUrl || invoice.xmlUrl ? (
                <div className="flex shrink-0 gap-2">
                  {invoice.pdfUrl ? (
                    <Button asChild variant="outline">
                      <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                        PDF
                      </a>
                    </Button>
                  ) : null}
                  {invoice.xmlUrl ? (
                    <Button asChild variant="outline">
                      <a href={invoice.xmlUrl} target="_blank" rel="noopener noreferrer">
                        XML
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
