"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { ArrowUpRight, ExternalLink, ShieldCheck } from "lucide-react";
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
import { newId } from "@/lib/new-id";
import { ASAAS_LOGIN_URL } from "./account-readiness-card";

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

  // Id do pedido (19/11/2026): o mesmo em clique duplo ou nova tentativa (o
  // servidor recusa o repetido); um novo a cada abertura e depois de uma recusa.
  const requestIdRef = useRef("");
  const sendingRef = useRef(false);
  useEffect(() => {
    if (open) requestIdRef.current = newId();
  }, [open]);

  // Saque criado no Asaas, mas esperando o codigo (evento critico): a gaveta
  // mostra o que falta em vez de fechar como se o Pix ja tivesse saido.
  const [awaitingConfirmationCents, setAwaitingConfirmationCents] = useState<number | null>(null);
  const handleOpenChange = (next: boolean) => {
    if (!next) setAwaitingConfirmationCents(null);
    onOpenChange(next);
  };

  // O envio monta o handleSubmit no clique (os refs so sao lidos fora da renderizacao).
  const submit = async (values: FormValues) => {
    if (sendingRef.current) return;
    if (values.amountCents > availableCents) {
      toast.error(
        `O valor solicitado é maior que o saldo disponível (${formatCents(availableCents)}).`,
      );
      return;
    }

    sendingRef.current = true;
    try {
      const res = await transfer.mutateAsync({
        organizationId,
        amountCents: values.amountCents,
        pixKey: values.pixKey,
        requestId: requestIdRef.current,
      });

      if (!res.success) {
        // Recusado: a proxima tentativa e outro pedido.
        requestIdRef.current = newId();
        toast.error(res.error || "Não foi possível realizar a transferência.");
        return;
      }

      if (res.needsConfirmation) {
        setAwaitingConfirmationCents(values.amountCents);
        return;
      }
      toast.success("Transferência Pix solicitada com sucesso!");
      onOpenChange(false);
    } catch {
      // Sem resposta (rede): o servidor pode ter sacado. Mantem o id: repetir
      // o mesmo pedido nao saca de novo.
      toast.error("Não deu para confirmar o saque. Confira em Saques antes de tentar de novo.");
    } finally {
      sendingRef.current = false;
    }
  };
  const onSubmit = (event?: React.BaseSyntheticEvent) => form.handleSubmit(submit)(event);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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

        {awaitingConfirmationCents !== null ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="transfer-awaiting-confirmation">
            <DialogBody className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Falta confirmar no Asaas</p>
                    <p className="text-sm text-muted-foreground">
                      O saque de {formatCents(awaitingConfirmationCents)} só sai depois da sua confirmação. Até lá, o
                      valor fica reservado.
                    </p>
                  </div>
                </div>
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Entre no site ou no app do Asaas com o e-mail financeiro.</li>
                <li>No aviso de evento crítico, toque em Enviar código.</li>
                <li>Digite o código que chegar por SMS. O Pix sai na hora.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Não quer mais o saque? Exclua no mesmo aviso e o valor volta para o saldo.
              </p>
            </DialogBody>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
              <Button asChild>
                <a href={ASAAS_LOGIN_URL} target="_blank" rel="noopener noreferrer">
                  Abrir minha conta no Asaas
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </div>
        ) : (
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
                required
                disabled={transfer.isPending}
              />

              <InputText<FormValues>
                name="pixKey"
                label="Chave Pix de destino"
                required
                placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                hint="A transferência será enviada via Pix para esta chave."
                disabled={transfer.isPending}
              />
            </DialogBody>

            <DialogFormFooter
              isPending={transfer.isPending}
              createLabel="Transferir"
              className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
            />
          </form>
        </FormProvider>
        )}
      </SheetContent>
    </Sheet>
  );
}
