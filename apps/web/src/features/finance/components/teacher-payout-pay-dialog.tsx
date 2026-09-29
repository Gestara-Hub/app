"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { PaymentMethod } from "@gestarahub/contracts";
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

interface TeacherPayoutPayDialogProps {
  open: boolean;
  teacherName: string;
  monthLabel: string;
  totalCents: number;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod) => void;
}

/**
 * Registro do pagamento do professor: mostra o valor e exige a forma de
 * pagamento antes de confirmar (evita baixa por clique acidental).
 */
export function TeacherPayoutPayDialog({
  open,
  teacherName,
  monthLabel,
  totalCents,
  isPending,
  onOpenChange,
  onConfirm,
}: TeacherPayoutPayDialogProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const close = (next: boolean) => {
    if (!next) setMethod(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            O valor entra no caixa como saída da categoria Professores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <dt className="text-muted-foreground">Professor</dt>
            <dd className="font-medium text-foreground">{teacherName}</dd>
            <dt className="text-muted-foreground">Mês trabalhado</dt>
            <dd className="text-foreground">{monthLabel}</dd>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatCents(totalCents)}</dd>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isPending}>
            Voltar
          </Button>
          <Button onClick={() => method && onConfirm(method)} disabled={!method || isPending}>
            {isPending ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
