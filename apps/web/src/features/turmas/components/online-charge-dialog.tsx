"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
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
import { calculateOnlineChargeAmounts, platformSplitCents } from "@gestarahub/core/payment-fees";
import { formatCents, formatDateTime } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { billingReminderTrigger, useWhatsAppSend } from "@/features/communication";
import { useOrganization } from "@/features/settings";
import { whatsappNumber } from "@/lib/whatsapp";
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
    description: "O aluno abre o link e paga com cartão de crédito ou débito.",
    icon: Link2,
  },
];

function whatsappMessage(input: {
  studentName: string;
  orgName?: string;
  charge: ChargeView;
  payment: OnlinePayment;
}): string {
  const firstName = input.studentName.split(" ")[0] || input.studentName;
  const what =
    input.charge.kind === "dropin"
      ? "a aula avulsa"
      : input.charge.kind === "extra"
        ? `${(input.charge.cycleTotal ?? 1) > 1 ? `a parcela ${input.charge.cycleIndex ?? 1} de ${input.charge.cycleTotal} de` : "a cobrança"} "${input.charge.description ?? ""}"`
        : input.charge.kind === "course"
          ? `${(input.charge.cycleTotal ?? 1) > 1 ? `a parcela ${input.charge.cycleIndex ?? 1} de ${input.charge.cycleTotal} do` : "o pagamento do"} curso "${input.charge.description ?? ""}"`
          : input.charge.kind === "package"
            ? `${(input.charge.cycleTotal ?? 1) > 1 ? `a parcela ${input.charge.cycleIndex ?? 1} de ${input.charge.cycleTotal} do` : "o pagamento do"} pacote "${input.charge.description ?? ""}"`
            : "a mensalidade";
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
  const whatsapp = useWhatsAppSend();
  // Forcar a escolha de novo metodo mesmo com um codigo valido em aberto.
  const [choosing, setChoosing] = useState(false);
  const [method, setMethod] = useState<OnlinePaymentMethod>("pix");
  const [passFee, setPassFee] = useState<boolean | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setChoosing(false);
      setMethod("pix");
      setPassFee(null);
    }
    onOpenChange(next);
  };

  const onlineSettings = org?.settings?.onlinePayments;
  const splitAmountCents = platformSplitCents(org?.subscription?.tier);
  const defaultPassFee =
    method === "pix"
      ? Boolean(onlineSettings?.passFeePix ?? onlineSettings?.passFeeToCustomer ?? false)
      : Boolean(onlineSettings?.passFeeCard ?? onlineSettings?.passFeeToCustomer ?? false);
  const activePassFee = passFee !== null ? passFee : defaultPassFee;

  // Tarifa do Asaas + taxa do GestaraHub (doc 19 §4). No link o aluno escolhe
  // credito ou debito, entao a tarifa mostrada e a do credito (a maior).
  const feePreview = calculateOnlineChargeAmounts({
    amountCents: charge?.amountCents ?? 0,
    method,
    splitAmountCents,
    passFee: activePassFee,
  });

  const payments = checkout.data?.payments ?? [];
  const awaiting = payments.find((p) => p.status === "awaiting");
  const lastExpired = !awaiting
    ? payments.find((p) => p.status === "expired")
    : undefined;
  const showChooser = !awaiting || choosing;

  const generate = () => {
    if (!charge) return;
    createMut.mutate(
      { chargeId: charge.id, method, passFeeToCustomer: activePassFee },
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

  const simulatePaid = (payment: OnlinePayment) => {
    if (!charge) return;
    paidMut.mutate(payment.id, {
      onSuccess: () => {
        toast.success("Pagamento online confirmado.");
        close(false);
      },
      onError: (err) =>
        toast.error(
          getErrorMessage(err, "Não foi possível confirmar o pagamento."),
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
    // Mesmo envio dos outros botoes: abre o WhatsApp (ou envia pelo oficial) e registra.
    whatsapp.send({
      trigger: charge.kind === "membership" ? billingReminderTrigger(charge, format(new Date(), "yyyy-MM-dd")) : "manual_broadcast",
      recipient: { name: checkout.data?.studentName || charge.studentName, phone: phone, clientId: charge.studentId },
      content: text,
      chargeId: charge.id,
    });
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

              {/* Repasse de taxa e prévia financeira */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <label
                      htmlFor="pass-fee-switch"
                      className="text-xs font-semibold text-foreground cursor-pointer"
                    >
                      Repassar taxa ao aluno
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      {method === "pix"
                        ? `Acréscimo fixo da tarifa e da taxa (+ ${formatCents(feePreview.totalFeeCents)})`
                        : "Acréscimo que cobre a tarifa do cartão de crédito"}
                    </p>
                  </div>
                  <Switch
                    id="pass-fee-switch"
                    checked={activePassFee}
                    onCheckedChange={(checked) => setPassFee(checked)}
                  />
                </div>

                <div className="rounded-md border border-border/60 bg-background/80 p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Valor nominal da cobrança:</span>
                    <span>{formatCents(charge?.amountCents ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>
                      Tarifa do Asaas
                      {method === "pix" ? " (Pix)" : " (cartão de crédito; no débito é menor)"}:
                    </span>
                    <span className={activePassFee ? "font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                      {activePassFee ? "+ " : "- "}
                      {formatCents(feePreview.gatewayFeeCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Taxa GestaraHub:</span>
                    <span className={activePassFee ? "font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                      {activePassFee ? "+ " : "- "}
                      {formatCents(feePreview.splitAmountCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1 font-semibold">
                    <span className="text-foreground">Aluno paga:</span>
                    <span className="text-foreground text-sm font-bold">
                      {formatCents(feePreview.chargedAmountCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{feePreview.estimated ? "Você recebe líquido, no mínimo:" : "Você recebe líquido:"}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCents(feePreview.netAmountCents)}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {activePassFee
                    ? feePreview.estimated
                      ? "✓ O acréscimo cobre a tarifa do cartão de crédito. Se o aluno pagar no débito, a diferença fica com você."
                      : "✓ Custo zero para você: entra na subconta exatamente o valor da cobrança."
                    : "• Tarifa do Asaas e taxa GestaraHub saem do valor que entra na subconta."}
                </p>
              </div>
            </div>
          ) : awaiting ? (
            <div className="space-y-4">
              {awaiting.method === "pix" ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-lg border bg-background p-2">
                    {awaiting.pixQrCodeBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${awaiting.pixQrCodeBase64}`}
                        alt="QR Code do Pix"
                        className="size-40 rounded object-contain"
                      />
                    ) : (
                      <IllustrativeQr
                        value={awaiting.pixCopyPaste ?? awaiting.id}
                        className="size-40"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {awaiting.pixQrCodeBase64
                      ? "Escaneie o QR Code no app do seu banco para pagar."
                      : "QR Code ilustrativo, não é lido por apps de banco."}
                  </p>
                </div>
              ) : null}

              {/* Resumo da cobrança gerada */}
              <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor a pagar:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">
                      {formatCents(awaiting.amountCents)}
                    </span>
                    {awaiting.feePassedToCustomer ? (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      >
                        Taxa repassada ao aluno
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5 text-muted-foreground"
                      >
                        Taxa absorvida
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Líquido para sua conta:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCents(awaiting.netAmountCents ?? awaiting.amountCents)}
                  </span>
                </div>
              </div>

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
                  onClick={() => setChoosing(true)}
                >
                  <RotateCw className="size-4" />
                  Gerar outro
                </Button>
              </div>

              {awaiting.gatewayProvider === "asaas" || Boolean(awaiting.pixQrCodeBase64) ? (
                <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Integração Asaas Ativa (Sandbox)
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cobrança real gerada no gateway com QR Code Pix oficial. Para testes no ambiente de homologação, você também pode simular a confirmação manual imediata.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={paidMut.isPending}
                    onClick={() => simulatePaid(awaiting)}
                    className="gap-1.5 text-xs"
                  >
                    <RotateCw className={cn("size-3", paidMut.isPending && "animate-spin")} />
                    {paidMut.isPending ? "Confirmando liquidação..." : "Simular liquidação (Sandbox)"}
                  </Button>
                </div>
              ) : (
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
                    disabled={paidMut.isPending}
                    onClick={() => void simulatePaid(awaiting)}
                  >
                    {paidMut.isPending ? "Confirmando..." : "Simular pagamento"}
                  </Button>
                </div>
              )}
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
    </>
  );
}
