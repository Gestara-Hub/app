"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import type { ChargeView, PaymentMethod } from "@gestarahub/contracts";
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
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

interface RegisterPaymentDialogProps {
  charge: ChargeView | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod) => void;
}

/**
 * Registro de pagamento: mostra o que esta sendo quitado e exige a forma de
 * pagamento antes de confirmar, evitando baixa por clique acidental.
 */
export function RegisterPaymentDialog({
  charge,
  isPending,
  onOpenChange,
  onConfirm,
}: RegisterPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const close = (open: boolean) => {
    if (!open) setMethod(null);
    onOpenChange(open);
  };

  const reference =
    charge?.periodStart && charge.periodEnd
      ? `${shortDate(charge.periodStart)} a ${shortDate(charge.periodEnd)}`
      : null;

  return (
    <Dialog open={charge !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Confirme o valor recebido e como o aluno pagou.
          </DialogDescription>
        </DialogHeader>

        {charge ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <dt className="text-muted-foreground">Aluno</dt>
              <dd className="font-medium text-foreground">{charge.studentName}</dd>
              <dt className="text-muted-foreground">
                {charge.kind === "dropin" ? "Aula avulsa" : "Mensalidade"}
              </dt>
              <dd className="text-foreground">
                vence {shortDate(charge.dueDate)}
                {reference ? ` · referente a ${reference}` : ""}
              </dd>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatCents(charge.amountCents)}
              </dd>
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
                      "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
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
          <Button
            onClick={() => method && onConfirm(method)}
            disabled={!method || isPending}
          >
            {isPending ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
