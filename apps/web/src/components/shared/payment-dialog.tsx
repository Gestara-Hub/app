"use client";

import { useEffect, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import type { DateISO, PaymentMethod } from "@gestarahub/contracts";
import { DateField, FileDropField, PaymentMethodField } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RECEIPT_FILE_RULES } from "@/lib/files";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/payment-form";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const defaults = (): Partial<PaymentFormValues> => ({ method: undefined, paidOn: todayISO(), receipts: [] });

/** O que o diálogo devolve: forma, dia do pagamento e comprovantes. */
export interface PaymentDialogResult {
  method: PaymentMethod;
  paidOn: DateISO;
  receipts: File[];
}

interface PaymentDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Resumo do que esta sendo pago (aluno/lancamento/professor e valor). */
  summary: ReactNode;
  confirmLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payment: PaymentDialogResult) => void;
}

/**
 * Registrar pagamento (RHF + Zod): resumo, forma de pagamento obrigatoria, dia
 * do pagamento (padrao hoje) e comprovantes opcionais (imagem ou PDF). O
 * proprio modal e a confirmacao da acao com dinheiro. Usado por Cobrancas,
 * Lancamentos e Professores.
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
    defaultValues: defaults(),
  });

  // Cada abertura comeca limpa (forma, data e comprovantes do pagamento anterior somem).
  useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, form]);

  // Sem forma escolhida o botao fica desabilitado (evita baixa por clique acidental).
  const method = useWatch({ control: form.control, name: "method" });

  const submit = form.handleSubmit((values) =>
    onConfirm({ method: values.method, paidOn: values.paidOn, receipts: values.receipts }),
  );

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
              <DateField<PaymentFormValues>
                name="paidOn"
                label="Pago em"
                max={todayISO()}
                disabled={isPending}
              />
              <FileDropField<PaymentFormValues>
                name="receipts"
                label="Comprovante (opcional)"
                disabled={isPending}
                {...RECEIPT_FILE_RULES}
              />
            </DialogBody>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
              {/* DialogClose (e nao onOpenChange direto): passa pelo "Descartar alterações?". */}
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
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
