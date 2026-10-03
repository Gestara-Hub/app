"use client";

import { useEffect, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaymentMethod } from "@gestarahub/contracts";
import { FileDropField, PaymentMethodField } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RECEIPT_FILE_RULES } from "@/lib/files";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/payment-form";

const DEFAULTS: Partial<PaymentFormValues> = { method: undefined, receipts: [] };

interface PaymentDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Resumo do que esta sendo pago (aluno/lancamento/professor e valor). */
  summary: ReactNode;
  confirmLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  /** `receipts` ainda nao e enviado ao service (upload entra com o backend). */
  onConfirm: (method: PaymentMethod, receipts: File[]) => void;
}

/**
 * Registrar pagamento (RHF + Zod): resumo, forma de pagamento obrigatoria e
 * comprovantes opcionais (imagem ou PDF). O proprio modal e a confirmacao da
 * acao com dinheiro. Usado por Mensalidades, Lancamentos e Professores.
 */
export function PaymentDialog({
  open,
  title,
  description,
  summary,
  confirmLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: PaymentDialogProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: DEFAULTS,
  });

  // Cada abertura comeca limpa (forma e comprovantes do pagamento anterior somem).
  useEffect(() => {
    if (open) form.reset(DEFAULTS);
  }, [open, form]);

  // Sem forma escolhida o botao fica desabilitado (evita baixa por clique acidental).
  const method = useWatch({ control: form.control, name: "method" });

  const submit = form.handleSubmit((values) => onConfirm(values.method, values.receipts));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 p-6 pb-2 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="space-y-4">
              {summary}
              <PaymentMethodField<PaymentFormValues> name="method" disabled={isPending} />
              <FileDropField<PaymentFormValues>
                name="receipts"
                label="Comprovante (opcional)"
                disabled={isPending}
                {...RECEIPT_FILE_RULES}
              />
            </DialogBody>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Voltar
              </Button>
              <Button type="submit" disabled={isPending || !method}>
                {isPending ? "Registrando..." : confirmLabel}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
