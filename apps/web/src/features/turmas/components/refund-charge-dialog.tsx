"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldCheck } from "lucide-react";
import type { ChargeView } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { formatCents } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { DateField, FileDropField, InputText, PaymentMethodField, SegmentedChoiceField } from "@/components/form";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { DialogBody, useReportDialogSaving } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RECEIPT_FILE_RULES, uploadedAttachments, uploadsSchema } from "@/lib/files";
import { paymentMethodLabel } from "@/lib/labels";
import { toast } from "@/lib/toast";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCurrentUser } from "@/features/auth";
import { ASAAS_LOGIN_URL, useSubaccountBalance } from "@/features/online-payments";
import { RefundBlockedError, useDisputedOnlinePayments, useOnlineCheckout, useRefundCharge } from "../hooks/use-billing";
import { getCycleTitle, isPaidOnline } from "./charge-parts";

/**
 * Devolver o pagamento de uma cobranca paga (26/11/2026, doc product/15
 * "Estorno de pagamento"). Pago online: o estorno do total sai do saldo da
 * conta de recebimento (conferido antes). Fora do app: so registra o dia, a
 * forma e o comprovante. Nos dois, escolhe o que fazer com a cobranca: reabrir
 * para pagar de outra forma ou encerrar como devolvida. Estorno feito direto no
 * Asaas ("Resolver"): so a escolha.
 */

const REASON_SUGGESTIONS = ["Trocou a forma de pagamento", "Aluno desistiu", "Pago por engano"];

const OUTCOME_OPTIONS = [
  { value: "reopened", label: "Reabrir", description: "O aluno vai pagar de outra forma." },
  { value: "closed", label: "Encerrar", description: "O aluno não deve mais nada." },
];

const schema = z
  .object({
    outcome: z.enum(["reopened", "closed"], { error: "Escolha o que fazer com a cobrança." }),
    manual: z.boolean(),
    method: z.enum(["pix", "cash", "card", "other"]).optional(),
    refundedOn: z.string(),
    receipts: uploadsSchema(RECEIPT_FILE_RULES),
    reason: z.string().trim().max(120, "Use até 120 caracteres."),
  })
  .superRefine((values, ctx) => {
    if (!values.manual) return;
    if (!values.method) ctx.addIssue({ code: "custom", path: ["method"], message: "Selecione como foi estornado." });
    if (!values.refundedOn) ctx.addIssue({ code: "custom", path: ["refundedOn"], message: "Informe a data do estorno." });
    else if (values.refundedOn > dateInSpace()) {
      ctx.addIssue({ code: "custom", path: ["refundedOn"], message: "A data do estorno não pode ser futura." });
    }
  });

type FormValues = z.infer<typeof schema>;

interface RefundChargeDialogProps {
  charge: ChargeView | null;
  onOpenChange: (open: boolean) => void;
}

export function RefundChargeDialog({ charge: current, onOpenChange }: RefundChargeDialogProps) {
  const charge = useRetainedValue(current);
  const open = current !== null;
  const online = charge ? isPaidOnline(charge) : false;
  const { organizationId } = useCurrentUser();
  const refund = useRefundCharge();
  useReportDialogSaving(refund.isPending);
  const { confirm, dialog: confirmDialog } = useConfirmAction();

  // Estorno ja feito no painel do Asaas (aviso "Pagamento estornado"): so falta decidir.
  const { data: disputed } = useDisputedOnlinePayments(open && online);
  const alreadyRefunded = Boolean(
    charge &&
      disputed?.some(
        (p) =>
          p.chargeId === charge.id &&
          !p.refundHandledAt &&
          (p.disputeStatus === "refunded" || p.disputeStatus === "refund_in_progress"),
      ),
  );
  const askPartner = online && !alreadyRefunded;
  const balance = useSubaccountBalance(open && askPartner ? organizationId : undefined);
  const availableCents = balance.data?.availableForTransferCents;
  const amountCents = charge?.amountCents ?? 0;
  const shortCents = askPartner && availableCents !== undefined && availableCents < amountCents ? amountCents - availableCents : 0;
  // Custo da devolucao (teste de 26/11/2026): no cartao a taxa do parceiro volta;
  // no Pix, nao (o espaco arca com ela). A taxa vem do pagamento online gravado.
  const checkout = useOnlineCheckout(open && askPartner && charge ? charge.id : null);
  const paidPayment = checkout.data?.payments.find((p) => p.status === "paid" && !p.refundHandledAt);
  const paidByPix = paidPayment ? paidPayment.paidMethod === "pix" || (!paidPayment.paidMethod && paidPayment.method === "pix") : charge?.method === "pix";
  const pixFeeCents = paidByPix ? paidPayment?.gatewayFeeCents : undefined;
  const paidByCard = paidPayment
    ? paidPayment.paidMethod === "creditCard" || paidPayment.paidMethod === "debitCard" || (!paidPayment.paidMethod && paidPayment.method === "link")
    : charge?.method === "card";
  // Pedido feito, mas o Asaas espera o token ou o codigo (evento critico): a gaveta diz o que falta.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const handleOpenChange = (next: boolean) => {
    if (!next) setAwaitingConfirmation(false);
    onOpenChange(next);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { outcome: undefined, manual: !online, method: undefined, refundedOn: dateInSpace(), receipts: [], reason: "" },
  });
  // Cada abertura comeca limpa.
  useEffect(() => {
    if (open) {
      form.reset({ outcome: undefined, manual: !online, method: undefined, refundedOn: dateInSpace(), receipts: [], reason: "" });
    }
  }, [open, online, form]);
  const outcome = useWatch({ control: form.control, name: "outcome" });

  const submit = form.handleSubmit(async (values) => {
    if (!charge) return;
    if (askPartner) {
      const ok = await confirm({
        title: `Estornar ${formatCents(amountCents)}?`,
        description: `O valor volta inteiro para ${charge.studentName} e sai da sua conta de recebimento. Depois de pedido, o estorno não pode ser desfeito.`,
        confirmLabel: "Estornar",
        variant: "destructive",
      });
      if (!ok) return;
    }
    try {
      const result = await refund.mutateAsync({
        chargeId: charge.id,
        online,
        outcome: values.outcome,
        reason: values.reason || undefined,
        refundedOn: values.manual ? values.refundedOn : undefined,
        method: values.manual ? values.method : undefined,
        receipts: values.manual ? uploadedAttachments(values.receipts) : undefined,
      });
      const what = values.outcome === "reopened" ? "Cobrança reaberta." : "Cobrança encerrada como estornada.";
      if (result.needsConfirmation) {
        setAwaitingConfirmation(true);
        return;
      }
      toast.success(`Pagamento estornado. ${what}`);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof RefundBlockedError && err.neededCents !== undefined && err.availableCents !== undefined) {
        toast.error(
          `Saldo disponível insuficiente: há ${formatCents(err.availableCents)} e o estorno precisa de ${formatCents(err.neededCents)}.`,
        );
        void balance.refetch();
        return;
      }
      toast.error(getErrorMessage(err, "Não foi possível estornar o pagamento."));
    }
  });

  const title = alreadyRefunded ? "Resolver estorno" : "Estornar pagamento";
  const confirmLabel = alreadyRefunded ? "Salvar" : askPartner ? `Estornar ${formatCents(amountCents)}` : "Registrar estorno";

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
        >
          {/* A confirmacao do estorno abre de dentro da gaveta (aberta fora dela, ficava por tras e o botao parecia nao responder). */}
          {confirmDialog}
          <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
            <SheetTitle className="text-lg font-semibold text-foreground">{title}</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {charge ? `${charge.studentName} · ${getCycleTitle(charge)}` : null}
            </SheetDescription>
          </SheetHeader>

          {awaitingConfirmation ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="refund-awaiting-confirmation">
              <DialogBody className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">Falta confirmar no Asaas</p>
                      <p className="text-sm text-muted-foreground">
                        O estorno de {formatCents(amountCents)} só sai depois da sua confirmação. A cobrança já foi
                        atualizada aqui.
                      </p>
                    </div>
                  </div>
                </div>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>Entre no site ou no app do Asaas com o e-mail financeiro.</li>
                  <li>No aviso de evento crítico, autorize pelo app ou peça o código.</li>
                  <li>Digite o código que chegar por SMS, se pedir. O valor volta para o aluno.</li>
                </ol>
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
            <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DialogBody className="space-y-4">
                {charge ? (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                    <p className="text-xl font-bold text-foreground">{formatCents(amountCents)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {online ? "Pago online" : "Pago"}
                      {charge.method ? ` via ${paymentMethodLabel(charge.method)}` : ""}
                      {charge.paidAt ? ` em ${new Date(charge.paidAt).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                    {/* Saldo da conta de recebimento ao lado do valor (26/11/2026: na linha solta ficava discreto). */}
                    {askPartner ? (
                      <div
                        className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3"
                        data-testid="refund-balance"
                      >
                        <span className="text-sm text-muted-foreground">Saldo disponível</span>
                        <span
                          className={
                            shortCents > 0
                              ? "text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                              : "text-base font-semibold tabular-nums text-foreground"
                          }
                        >
                          {balance.isLoading ? "Conferindo..." : availableCents !== undefined ? formatCents(availableCents) : "—"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {alreadyRefunded ? (
                  <Notice tone="info" title="O estorno já foi feito no parceiro">Falta decidir o que acontece com a cobrança.</Notice>
                ) : askPartner ? (
                  <>
                    {/* Um texto so, o da forma que o aluno usou (26/11/2026: o geral de Pix e cartao confundia). */}
                    {checkout.isLoading ? null : paidByPix ? (
                      <Notice tone="warning" title={pixFeeCents ? `Este estorno custa ${formatCents(pixFeeCents)} ao espaço` : "A taxa do Pix fica com o espaço"}>
                        O valor volta inteiro para a conta que pagou o Pix. A taxa do Pix
                        {pixFeeCents ? ` (${formatCents(pixFeeCents)})` : ""} não volta.
                      </Notice>
                    ) : paidByCard ? (
                      <Notice tone="success" title="O estorno não custa nada ao espaço">
                        O valor volta inteiro na fatura do cartão do aluno, e as taxas voltam para a sua conta.
                      </Notice>
                    ) : (
                      <Notice tone="info" title="O valor volta inteiro para o aluno">
                        O estorno sai do saldo da sua conta de recebimento.
                      </Notice>
                    )}
                    {shortCents > 0 ? (
                      <Notice tone="warning" title={`Faltam ${formatCents(shortCents)} de saldo disponível`}>
                        Espere novos recebimentos ou estorne fora do app e registre aqui depois.
                      </Notice>
                    ) : null}
                  </>
                ) : (
                  <>
                    <PaymentMethodField<FormValues> name="method" label="Estornado via" disabled={refund.isPending} />
                    <DateField<FormValues>
                      name="refundedOn"
                      label="Estornado em"
                      required
                      max={dateInSpace()}
                      disabled={refund.isPending}
                    />
                    <FileDropField<FormValues>
                      name="receipts"
                      label="Comprovante (opcional)"
                      disabled={refund.isPending}
                      {...RECEIPT_FILE_RULES}
                    />
                  </>
                )}

                <div className="space-y-2">
                  <SegmentedChoiceField<FormValues>
                    name="outcome"
                    label="E a cobrança?"
                    required
                    allowEmpty
                    options={OUTCOME_OPTIONS}
                    ariaLabel="O que fazer com a cobrança"
                    variant="cards"
                    disabled={refund.isPending}
                  />
                  {outcome === "reopened" ? (
                    <p className="text-xs text-muted-foreground">Volta para A receber, ou Em atraso se já venceu.</p>
                  ) : outcome === "closed" ? (
                    <p className="text-xs text-muted-foreground">Fica como Estornada e sai do Recebido.</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <InputText<FormValues>
                    name="reason"
                    label="Motivo (opcional)"
                    placeholder="Informe o motivo do estorno"
                    disabled={refund.isPending}
                  />
                  <div className="flex flex-wrap gap-1">
                    {REASON_SUGGESTIONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        disabled={refund.isPending}
                        onClick={() => form.setValue("reason", reason, { shouldDirty: true })}
                        className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        + {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </DialogBody>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
                <SheetClose asChild>
                  <Button type="button" variant="outline" disabled={refund.isPending}>
                    Cancelar
                  </Button>
                </SheetClose>
                <Button
                  type="submit"
                  variant={askPartner ? "destructive" : "default"}
                  disabled={refund.isPending || shortCents > 0 || (askPartner && balance.isLoading)}
                >
                  {refund.isPending ? "Estornando..." : confirmLabel}
                </Button>
              </div>
            </form>
          </FormProvider>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

const NOTICE_TONE = {
  info: { box: "border-sky-500/30 bg-sky-500/10", icon: "text-sky-600 dark:text-sky-400", Icon: Info },
  success: { box: "border-emerald-500/30 bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  warning: { box: "border-amber-500/30 bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", Icon: AlertTriangle },
} as const;

/** Aviso da devolucao: titulo em destaque e o detalhe embaixo, na cor do que significa. */
function Notice({ tone, title, children }: { tone: keyof typeof NOTICE_TONE; title?: string; children: React.ReactNode }) {
  const { box, icon, Icon } = NOTICE_TONE[tone];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3.5 ${box}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${icon}`} />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="break-words text-sm font-semibold text-foreground">{title}</p> : null}
        <p className="break-words text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
