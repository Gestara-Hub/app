"use client";

import type { PaymentMethod } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { PaymentDialog } from "@/components/shared/payment-dialog";

interface TeacherPayoutPayDialogProps {
  open: boolean;
  teacherName: string;
  monthLabel: string;
  totalCents: number;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (method: PaymentMethod, receipts: File[]) => void;
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
  return (
    <PaymentDialog
      open={open}
      title="Registrar pagamento"
      description="O valor entra no caixa como saída da categoria Professores."
      confirmLabel="Registrar pagamento"
      isPending={isPending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      summary={
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <dt className="text-muted-foreground">Professor</dt>
          <dd className="font-medium text-foreground">{teacherName}</dd>
          <dt className="text-muted-foreground">Mês trabalhado</dt>
          <dd className="text-foreground">{monthLabel}</dd>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-semibold tabular-nums text-foreground">{formatCents(totalCents)}</dd>
        </dl>
      }
    />
  );
}
