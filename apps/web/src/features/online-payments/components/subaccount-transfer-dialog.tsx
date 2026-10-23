"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { InputCurrency, InputText, DialogFormFooter } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCents } from "@gestarahub/core/format";
import { useRequestSubaccountTransfer } from "../hooks/use-online-payments";

const schema = z.object({
  amountCents: z
    .number()
    .min(500, "O valor mínimo de transferência é R$ 5,00."),
  pixKey: z.string().trim().min(3, "Informe a chave Pix de destino."),
});

type FormValues = z.infer<typeof schema>;

interface SubaccountTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  availableCents: number;
  defaultPixKey?: string;
}

export function SubaccountTransferDialog({
  open,
  onOpenChange,
  organizationId,
  availableCents,
  defaultPixKey = "",
}: SubaccountTransferDialogProps) {
  const transfer = useRequestSubaccountTransfer();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amountCents: availableCents,
      pixKey: defaultPixKey,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.amountCents > availableCents) {
      toast.error(
        `O valor solicitado é maior que o saldo disponível (${formatCents(availableCents)}).`,
      );
      return;
    }

    try {
      const res = await transfer.mutateAsync({
        organizationId,
        amountCents: values.amountCents,
        pixKey: values.pixKey,
      });

      if (!res.success) {
        toast.error(res.error || "Não foi possível realizar a transferência.");
        return;
      }

      toast.success("Transferência Pix solicitada com sucesso!");
      onOpenChange(false);
    } catch {
      toast.error("Erro inesperado ao solicitar transferência.");
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <ArrowUpRight className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-foreground">
                Transferir saldo (Pix)
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Transfira o saldo disponível da sua subconta para sua conta
                bancária.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            onSubmit={onSubmit}
            noValidate
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saldo disponível para saque:</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold text-primary hover:underline"
                    onClick={() => form.setValue("amountCents", availableCents)}
                  >
                    Sacar tudo
                  </Button>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {formatCents(availableCents)}
                </p>
              </div>

              <InputCurrency<FormValues>
                name="amountCents"
                label="Valor a transferir"
                disabled={transfer.isPending}
              />

              <InputText<FormValues>
                name="pixKey"
                label="Chave Pix de destino"
                placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                hint="A transferência será enviada via Pix para esta chave."
                disabled={transfer.isPending}
              />
            </DialogBody>

            <DialogFormFooter
              isPending={transfer.isPending}
              createLabel="Confirmar transferência Pix"
              className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
            />
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}
