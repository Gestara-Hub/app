"use client";

import type { FinanceEntryView, PaymentMethod } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { financialEntryTypeLabel } from "@/lib/labels";
import { useRetainedValue } from "@/lib/use-retained-value";
import { fullDate } from "../finance-ui";

/**
 * Marcar pago: mostra o lancamento e exige a forma de pagamento antes de
 * confirmar (o proprio modal e a confirmacao da acao com dinheiro).
 */
export function FinancePaymentDialog({
  row: current,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  row: FinanceEntryView | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod, receipts: File[]) => void;
}) {
  // Resumo com o ultimo lancamento: nao some durante a animacao de saida.
  const row = useRetainedValue(current);
  const isIncome = row?.type === "income";

  return (
    <PaymentDialog
      open={current !== null}
      title={isIncome ? "Registrar recebimento" : "Registrar pagamento"}
      description="Confirme o valor e a forma de pagamento. Entra no caixa com a data de hoje."
      confirmLabel="Marcar como pago"
      isPending={isPending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      summary={
        row ? (
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
        ) : null
      }
    />
  );
}
