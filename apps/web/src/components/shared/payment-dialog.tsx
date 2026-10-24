"use client";

import { useEffect, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { DateISO, PaymentMethod } from "@gestarahub/contracts";
import { DateField, FileDropField, PaymentMethodField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RECEIPT_FILE_RULES } from "@/lib/files";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/payment-form";
import { dateInSpace } from "@gestarahub/core/date";

const todayISO = () => dateInSpace();
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
 * do pagamento (padrao hoje) e comprovantes opcionais (imagem ou PDF). Abre em
 * drawer, como os outros formularios. O proprio drawer e a confirmacao da acao
 * com dinheiro. Usado por Cobrancas, Lancamentos e Professores.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">{title}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{description}</SheetDescription>
        </SheetHeader>

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
              {/* SheetClose (e nao onOpenChange direto): passa pelo "Descartar alterações?". */}
              <SheetClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </SheetClose>
              <Button type="submit" disabled={isPending || !method}>
                {isPending ? "Registrando..." : confirmLabel}
              </Button>
            </div>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}
