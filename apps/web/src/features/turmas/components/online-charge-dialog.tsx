"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  Copy,
  FlaskConical,
  Link2,
  MessageCircle,
  QrCode,
  RotateCw,
} from "lucide-react";
import type {
  ChargeView,
  OnlinePayment,
  OnlinePaymentMethod,
} from "@gestarahub/contracts";
import { formatCents, formatDateTime } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/features/settings";
import {
  useCreateOnlinePayment,
  useOnlineCheckout,
  useSimulateOnlinePaid,
} from "../hooks/use-billing";
import { IllustrativeQr } from "./illustrative-qr";

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

const METHOD_OPTIONS: {
  value: OnlinePaymentMethod;
  label: string;
  description: string;
  icon: typeof QrCode;
}[] = [
  {
    value: "pix",
    label: "Pix",
    description: "Código copia e cola e QR Code. Cai na hora.",
    icon: QrCode,
  },
  {
    value: "link",
    label: "Link de pagamento",
    description: "O aluno abre o link e paga com cartão.",
    icon: Link2,
  },
];

/** "11999998888" -> "5511999998888" (wa.me pede DDI). */
function whatsappNumber(phone?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

function whatsappMessage(input: {
  studentName: string;
  orgName?: string;
  charge: ChargeView;
  payment: OnlinePayment;
}): string {
  const firstName = input.studentName.split(" ")[0] || input.studentName;
  const what =
    input.charge.kind === "dropin" ? "a aula avulsa" : "a mensalidade";
  const from = input.orgName ? ` da ${input.orgName}` : "";
  const header = `Olá, ${firstName}! Segue ${what}${from} no valor de ${formatCents(input.payment.amountCents)}, com vencimento em ${shortDate(input.charge.dueDate)}.`;
  const body =
    input.payment.method === "pix"
      ? `Pix copia e cola:\n${input.payment.pixCopyPaste ?? ""}`
      : `Pague pelo link:\n${input.payment.linkUrl ?? ""}`;
  return `${header}\n\n${body}\n\nVálido até ${formatDateTime(input.payment.expiresAt)}.`;
}

async function copyText(text: string, success: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error(
      "Não foi possível copiar. Selecione o texto e copie manualmente.",
    );
  }
}

interface OnlineChargeDialogProps {
  charge: ChargeView | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Cobrar online" (simulado, docs/technical/05 secao 6.3): escolhe Pix ou link,
 * mostra o copia e cola, o QR ilustrativo e o link, com Copiar e Enviar pelo
 * WhatsApp. "Simular pagamento" e so da demonstracao.
 */
export function OnlineChargeDialog({
  charge,
  onOpenChange,
}: OnlineChargeDialogProps) {
  const open = charge !== null;
  const checkout = useOnlineCheckout(charge?.id ?? null);
  const createMut = useCreateOnlinePayment();
  const paidMut = useSimulateOnlinePaid();
  const { data: org } = useOrganization();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // Forcar a escolha de novo metodo mesmo com um codigo valido em aberto.
  const [choosing, setChoosing] = useState(false);
  const [method, setMethod] = useState<OnlinePaymentMethod>("pix");

  const close = (next: boolean) => {
    if (!next) {
      setChoosing(false);
      setMethod("pix");
    }
    onOpenChange(next);
  };

  const payments = checkout.data?.payments ?? [];
  const awaiting = payments.find((p) => p.status === "awaiting");
  const lastExpired = !awaiting
    ? payments.find((p) => p.status === "expired")
    : undefined;
  const showChooser = !awaiting || choosing;

  const generate = () => {
    if (!charge) return;
    createMut.mutate(
      { chargeId: charge.id, method },
      {
        onSuccess: () => {
          setChoosing(false);
          toast.success(
            method === "pix" ? "Pix gerado." : "Link de pagamento gerado.",
          );
        },
        onError: (err) =>
          toast.error(
            getErrorMessage(err, "Não foi possível gerar a cobrança online."),
          ),
      },
    );
  };

  const simulatePaid = async (payment: OnlinePayment) => {
    if (!charge) return;
    const ok = await confirm({
      title: "Simular pagamento?",
      description: `Demonstração: faz de conta que ${charge.studentName} pagou ${formatCents(payment.amountCents)} ${payment.method === "pix" ? "pelo Pix" : "pelo link"}. A cobrança fica paga como "Pago online" e não pode ser desfeita.`,
      confirmLabel: "Simular pagamento",
    });
    if (!ok) return;
    paidMut.mutate(payment.id, {
      onSuccess: () => {
        toast.success("Pagamento online confirmado.");
        close(false);
      },
      onError: (err) =>
        toast.error(
          getErrorMessage(err, "Não foi possível simular o pagamento."),
        ),
    });
  };

  const phone = whatsappNumber(checkout.data?.studentPhone);
  const sendWhatsapp = (payment: OnlinePayment) => {
    if (!charge || !phone) return;
    const text = whatsappMessage({
      studentName: checkout.data?.studentName || charge.studentName,
      orgName: org?.name,
      charge,
      payment,
    });
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cobrar online</DialogTitle>
            <DialogDescription>
              {charge
                ? `${charge.studentName} · ${formatCents(charge.amountCents)} · vence ${shortDate(charge.dueDate)}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {checkout.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : checkout.isError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertCircle className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar a cobrança online.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void checkout.refetch()}
              >
                <RotateCw className="size-4" />
                Tentar novamente
              </Button>
            </div>
          ) : showChooser ? (
            <div className="space-y-4">
              {lastExpired ? (
                <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  O último código expirou em{" "}
                  {formatDateTime(lastExpired.expiresAt)}. Gere um novo.
                </p>
              ) : null}
              {awaiting && choosing ? (
                <p className="text-xs text-muted-foreground">
                  Gerar um novo cancela o código em aberto desta cobrança.
                </p>
              ) : null}
              <div
                role="radiogroup"
                aria-label="Forma de cobrança"
                className="grid gap-2"
              >
                {METHOD_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = method === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMethod(opt.value)}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-foreground bg-muted"
                          : "border-border/70 hover:bg-muted/50",
                      )}
                    >
                      <Icon
                        className="mt-0.5 size-5 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium text-foreground">
                          {opt.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : awaiting ? (
            <div className="space-y-4">
              {awaiting.method === "pix" ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-lg border bg-background p-2">
                    <IllustrativeQr
                      value={awaiting.pixCopyPaste ?? awaiting.id}
                      className="size-40"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    QR Code ilustrativo, não é lido por apps de banco.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {awaiting.method === "pix"
                    ? "Pix copia e cola"
                    : "Link de pagamento"}
                </p>
                <div className="flex items-start gap-2">
                  <p
                    className="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground select-all"
                    aria-label={
                      awaiting.method === "pix"
                        ? "Código Pix copia e cola"
                        : "Link de pagamento"
                    }
                  >
                    {awaiting.method === "pix"
                      ? awaiting.pixCopyPaste
                      : awaiting.linkUrl}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void copyText(
                        (awaiting.method === "pix"
                          ? awaiting.pixCopyPaste
                          : awaiting.linkUrl) ?? "",
                        awaiting.method === "pix"
                          ? "Código Pix copiado."
                          : "Link copiado.",
                      )
                    }
                  >
                    <Copy className="size-4" />
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Válido até {formatDateTime(awaiting.expiresAt)}. Depois disso,
                  gere um novo.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  title={
                    phone ? undefined : "O aluno não tem telefone cadastrado."
                  }
                  className="inline-flex"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!phone}
                    onClick={() => sendWhatsapp(awaiting)}
                  >
                    <MessageCircle className="size-4" />
                    Enviar pelo WhatsApp
                  </Button>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setChoosing(true)}
                >
                  <RotateCw className="size-4" />
                  Gerar outro
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <FlaskConical className="size-3.5" aria-hidden />
                  Demonstração
                </p>
                <p className="text-xs text-muted-foreground">
                  Não há banco de verdade nesta versão. Use o botão para ver a
                  cobrança sendo paga.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={paidMut.isPending}
                  onClick={() => void simulatePaid(awaiting)}
                >
                  {paidMut.isPending ? "Confirmando..." : "Simular pagamento"}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {showChooser && !checkout.isLoading && !checkout.isError ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    awaiting && choosing ? setChoosing(false) : close(false)
                  }
                  disabled={createMut.isPending}
                >
                  Voltar
                </Button>
                <Button onClick={generate} disabled={createMut.isPending}>
                  {createMut.isPending
                    ? "Gerando..."
                    : method === "pix"
                      ? "Gerar Pix"
                      : "Gerar link"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => close(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
