"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { InputCurrency, InputText, DialogFormFooter } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <ArrowUpRight className="size-5" />
            </div>
            <div>
              <DialogTitle>Transferir saldo (Pix)</DialogTitle>
              <DialogDescription>
                Transfira o saldo disponível da sua subconta para sua conta bancária.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4 pt-2">
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

            <DialogFormFooter
              isPending={transfer.isPending}
              createLabel="Confirmar transferência Pix"
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
