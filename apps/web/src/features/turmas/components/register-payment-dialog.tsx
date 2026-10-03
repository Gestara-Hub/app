"use client";

import { format, parseISO } from "date-fns";
import type { ChargeView, PaymentMethod } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

interface RegisterPaymentDialogProps {
  charge: ChargeView | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod, receipts: File[]) => void;
}

/**
 * Registro de pagamento: mostra o que esta sendo quitado e exige a forma de
 * pagamento antes de confirmar, evitando baixa por clique acidental.
 */
export function RegisterPaymentDialog({
  charge: current,
  isPending,
  onOpenChange,
  onConfirm,
}: RegisterPaymentDialogProps) {
  // Resumo com a ultima cobranca: nao some durante a animacao de saida.
  const charge = useRetainedValue(current);
  const reference =
    charge?.periodStart && charge.periodEnd
      ? `${shortDate(charge.periodStart)} a ${shortDate(charge.periodEnd)}`
      : null;

  return (
    <PaymentDialog
      open={current !== null}
      title="Registrar pagamento"
      description="Confirme o valor recebido e como o aluno pagou."
      confirmLabel="Registrar pagamento"
      isPending={isPending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      summary={
        charge ? (
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
        ) : null
      }
    />
  );
}
