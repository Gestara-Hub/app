"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  QrCode,
  Receipt,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@gestarahub/contracts";
import { formatCents, formatDate } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { isPlanDebitedAutomatically, planNoticeFor } from "@gestarahub/core/subscription-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PixQrCode } from "@/components/shared/pix-qr-code";
import { subscriptionTierLabel } from "@/lib/labels";
import { browserPaymentsTestMode } from "@/lib/payments-test-mode";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  getPendingSubscriptionPixAction,
  simulateAsaasSubscriptionPaymentAction,
  type SubscriptionPendingPixResult,
} from "@/services/subscription/actions";

/** Dias antes do vencimento em que a fatura passa a pedir o pagamento. */
const DUE_SOON_DAYS = 5;

export function PendingSubscriptionInvoiceCard({
  subscription,
}: {
  subscription: Subscription | undefined;
}) {
  const qc = useQueryClient();
  const isPro = subscription && subscription.tier !== "free";

  const today = todayISO();
  const notice = planNoticeFor(subscription, today);
  const isPastDue = subscription?.status === "past_due";
  // O Asaas gera a proxima cobranca logo depois do pagamento: so vira "aguardando
  // pagamento" nos ultimos dias (19/11/2026: com 28 dias de folga o cartao laranja
  // parecia atraso). Antes disso, so "Pagar antecipado", para quem quiser.
  const dueDate = subscription?.pendingPayment?.dueDate ?? subscription?.renewsOn;
  const daysToDue = dueDate ? differenceInCalendarDays(parseISO(dueDate), parseISO(today)) : null;
  const pendingDueSoon = Boolean(subscription?.pendingPayment) && daysToDue !== null && daysToDue <= DUE_SOON_DAYS;
  const debited = subscription ? isPlanDebitedAutomatically(subscription) : false;
  const hasPendingInvoice = isPastDue || Boolean(notice) || (pendingDueSoon && !debited);
  const hasPendingPayment = hasPendingInvoice;

  const isUrgent = isPastDue || notice?.kind === "grace_ending" || notice?.kind === "reverted";
  const isDueSoon = notice?.kind === "renews_soon" || notice?.kind === "payment_pending";

  const [isExpanded, setIsExpanded] = useState(hasPendingInvoice);
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const { data: pixData, isLoading: isLoadingPix, error: pixError } = useQuery({
    queryKey: ["subscription", "pending-pix", subscription?.pendingPayment?.id ?? subscription?.renewsOn],
    queryFn: async (): Promise<SubscriptionPendingPixResult> => {
      const res = await getPendingSubscriptionPixAction();
      if (!res.ok) throw new Error(res.error || "Não foi possível carregar os dados do Pix.");
      return res;
    },
    enabled: isExpanded && Boolean(isPro),
    staleTime: 60_000,
  });

  if (!isPro || subscription.courtesyUntil) return null;

  // Cartao ou Pix Automatico em dia: cobrado sozinho, nada a pagar aqui.
  if (debited && !hasPendingInvoice) {
    return dueDate ? (
      <p className="flex items-center gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
        <CalendarClock className="size-4 shrink-0" aria-hidden />
        <span>
          Próxima fatura em {formatDate(dueDate)}:{" "}
          {subscription.paymentMethod === "credit_card"
            ? "cobrada no cartão automaticamente."
            : "debitada pelo Pix Automático."}
        </span>
      </p>
    ) : null;
  }

  const handleCopyPix = () => {
    if (!pixData?.pixQrCode?.payload) return;
    void navigator.clipboard.writeText(pixData.pixQrCode.payload);
    setCopied(true);
    toast.success("Código Pix Copia e Cola copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulatePayment = async () => {
    if (!pixData?.paymentId) return;
    setIsSimulating(true);
    try {
      const res = await simulateAsaasSubscriptionPaymentAction(
        pixData.paymentId,
        subscription.tier as "pro" | "scale",
        subscription.interval ?? "monthly",
        subscription.asaasSubscriptionId,
      );

      if (res.success) {
        toast.success("Pagamento da fatura confirmado com sucesso!");
        qc.invalidateQueries({ queryKey: queryKeys.subscription.detail });
        qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
        qc.invalidateQueries({ queryKey: queryKeys.audit.all });
        qc.invalidateQueries({ queryKey: ["subscription", "pending-pix"] });
      } else {
        toast.error(res.error || "Não foi possível liquidar a fatura.");
      }
    } catch {
      toast.error("Falha ao simular confirmação de pagamento.");
    } finally {
      setIsSimulating(false);
    }
  };

  const planName = subscriptionTierLabel(subscription.tier);
  const intervalName = subscription.interval === "yearly" ? "Anual" : "Mensal";
  const dueDateFormatted = pixData?.dueDate
    ? formatDate(pixData.dueDate)
    : subscription.renewsOn
      ? formatDate(subscription.renewsOn)
      : null;
  const amountFormatted = pixData?.amountCents
    ? formatCents(pixData.amountCents)
    : subscription.priceCents
      ? formatCents(subscription.priceCents)
      : "R$ 79,90";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isUrgent
          ? "border-destructive/40 bg-destructive/5"
          : isDueSoon || hasPendingPayment
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border/70 bg-muted/20",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
              isUrgent
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : isDueSoon || hasPendingPayment
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border bg-background text-foreground",
            )}
          >
            {isUrgent ? (
              <AlertTriangle className="size-4.5" />
            ) : hasPendingInvoice ? (
              <Receipt className="size-4.5" />
            ) : (
              <CalendarClock className="size-4.5" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {hasPendingInvoice ? "Fatura de renovação do plano" : "Próxima fatura do plano"}
              </h3>
              <Badge
                variant={isUrgent ? "destructive" : isDueSoon || hasPendingPayment ? "default" : "secondary"}
                className={cn(
                  "text-[10px] uppercase font-semibold",
                  !isUrgent && (isDueSoon || hasPendingPayment) && "bg-amber-600 text-white hover:bg-amber-600",
                )}
              >
                {isPastDue
                  ? "Vencida"
                  : isDueSoon || hasPendingPayment
                    ? "Aguardando Pagamento"
                    : "Em Dia"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Plano {planName} ({intervalName}) · <strong className="text-foreground">{amountFormatted}</strong>
              {dueDateFormatted ? <> · Vence em {dueDateFormatted}</> : null}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant={isExpanded || !hasPendingInvoice ? "outline" : "default"}
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0"
        >
          <QrCode className="size-3.5" />
          <span>{isExpanded ? "Ocultar Pix" : hasPendingInvoice ? "Ver QR Code Pix" : "Pagar antecipado"}</span>
          {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>
      </div>

      {isExpanded ? (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-4 animate-in fade-in-50 duration-200">
          {isLoadingPix ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Gerando chave Pix para pagamento...</span>
            </div>
          ) : pixData?.pixQrCode?.payload ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border/60 bg-background/80 p-3.5">
                <div className="size-40 shrink-0 rounded-lg border bg-white p-2.5 shadow-xs">
                  <PixQrCode value={pixData.pixQrCode.payload} />
                </div>

                <div className="space-y-2 min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Abra o aplicativo do seu banco, escolha a opção <strong>Pix</strong> e aponte a câmera para o QR Code ao lado ou utilize o código Copia e Cola:
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={pixData.pixQrCode.payload}
                        className="font-mono text-xs bg-muted/40 text-foreground select-all"
                        aria-label="Código Pix Copia e Cola"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyPix}
                        className="gap-1.5 shrink-0 text-xs font-medium"
                      >
                        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        {copied ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Baixa instantânea via Pix
                    </span>
                    {pixData.invoiceUrl ? (
                      <a
                        href={pixData.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                      >
                        <ExternalLink className="size-3" />
                        Ver fatura no Asaas
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Botão de simulação para desenvolvimento e testes */}
              {browserPaymentsTestMode() ? (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                    <FlaskConical className="size-3.5 shrink-0" />
                    <span>Ambiente de testes (Sandbox)</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSimulating}
                    onClick={handleSimulatePayment}
                    className="h-7 text-[11px] border-amber-500/50 hover:bg-amber-500/20"
                  >
                    {isSimulating ? "Confirmando..." : "Simular liquidação Pix"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : pixData?.invoiceUrl ? (
            // Sem o QR: a fatura do parceiro (Pix ou cartao).
            <Button asChild variant="outline" className="w-full">
              <a href={pixData.invoiceUrl} target="_blank" rel="noopener noreferrer">
                Abrir a fatura para pagar
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              {pixError instanceof Error ? pixError.message : "Não foi possível gerar os dados do Pix no momento."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
