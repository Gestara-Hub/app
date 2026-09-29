"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { FinanceEntryView, PaymentMethod } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_METHODS, financialEntryTypeLabel, paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fullDate } from "../finance-ui";

/**
 * Marcar pago: mostra o lancamento e exige a forma de pagamento antes de
 * confirmar (o proprio modal e a confirmacao da acao com dinheiro).
 */
export function FinancePaymentDialog({
  row,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  row: FinanceEntryView | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const close = (open: boolean) => {
    if (!open) setMethod(null);
    onOpenChange(open);
  };

  const isIncome = row?.type === "income";

  return (
    <Dialog open={row !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isIncome ? "Registrar recebimento" : "Registrar pagamento"}</DialogTitle>
          <DialogDescription>
            Confirme o valor e a forma de pagamento. Entra no caixa com a data de hoje.
          </DialogDescription>
        </DialogHeader>

        {row ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <dt className="text-muted-foreground">{financialEntryTypeLabel(row.type)}</dt>
              <dd className="font-medium text-foreground">{row.description}</dd>
              <dt className="text-muted-foreground">Categoria</dt>
              <dd className="text-foreground">{row.categoryName}</dd>
              <dt className="text-muted-foreground">Vencimento</dt>
              <dd className="text-foreground">{fullDate(row.dueDate)}</dd>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-semibold tabular-nums text-foreground">{formatCents(row.amountCents)}</dd>
            </dl>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Forma de pagamento</p>
              <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      method === m
                        ? "border-foreground bg-muted text-foreground"
                        : "border-border/70 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {method === m ? <Check className="size-4" /> : null}
                    {paymentMethodLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isPending}>
            Voltar
          </Button>
          <Button onClick={() => method && onConfirm(method)} disabled={!method || isPending}>
            {isPending ? "Registrando..." : "Marcar como pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
