"use client";

import { useState } from "react";
import { Copy, ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents, formatDate } from "@gestarahub/core/format";
import type { PlanChangeQuote } from "@gestarahub/core/subscription-plan";
import type { SubscriptionInterval, SubscriptionTier } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { subscriptionTierLabel } from "@/lib/labels";
import { browserPaymentsTestMode } from "@/lib/payments-test-mode";
import type { PlanChangeStart } from "@/services/server/subscriptionPlan";
import type { PlanTarget } from "@/services/subscription/actions";
import { usePlanChange, usePlanChangePreview } from "../hooks/use-plan-change";
import { usePaymentPolling } from "@/hooks/use-payment-polling";

const per = (interval: SubscriptionInterval) => (interval === "yearly" ? "/ano" : "/mês");
const planName = (tier: SubscriptionTier) => (tier === "free" ? "Grátis" : `Plano ${subscriptionTierLabel(tier)}`);

/**
 * Troca de plano com a conta antes de cobrar (doc product/13 §6): o que
 * aumenta e pago hoje pela diferenca; o que reduz fica marcado para o fim do
 * periodo pago. Nada e cobrado sem a confirmacao.
 */
export function PlanChangeDialog({
  target,
  onOpenChange,
}: {
  target: PlanTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {target ? <PlanChangeBody key={`${target.tier}-${target.interval}`} target={target} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PlanChangeBody({ target, onClose }: { target: PlanTarget; onClose: () => void }) {
  const preview = usePlanChangePreview(target);
  const { change, simulate, checkPayment } = usePlanChange();
  const [awaiting, setAwaiting] = useState<Extract<PlanChangeStart, { kind: "awaiting_payment" }>["payment"] | null>(null);

  // Pix da diferenca: confere ate o servidor ligar o plano (pausa com a aba escondida).
  usePaymentPolling(async () => {
    if (!awaiting) return true;
    const res = await checkPayment(awaiting.id);
    if (!res.isPaid) return false;
    toast.success(`${planName(target.tier)} ativado.`);
    onClose();
    return true;
  }, Boolean(awaiting));

  const title = target.tier === "free" ? "Voltar ao Grátis?" : `Mudar para o ${planName(target.tier)}?`;

  if (awaiting) {
    return (
      <>
        <DialogHeader className="shrink-0">
          <DialogTitle>Pague a diferença</DialogTitle>
          <DialogDescription>
            {formatCents(awaiting.amountCents)} para mudar para o {planName(target.tier)}. Libera assim que o pagamento cair.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {awaiting.pixQrCode ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${awaiting.pixQrCode.encodedImage}`}
                  alt="QR Code do Pix"
                  className="size-44 object-contain"
                />
              </div>
              <div className="flex w-full gap-2">
                <Input readOnly value={awaiting.pixQrCode.payload} className="font-mono text-base md:text-xs" aria-label="Pix copia e cola" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(awaiting.pixQrCode?.payload ?? "");
                    toast.success("Código Pix copiado.");
                  }}
                >
                  <Copy className="size-4" />
                  Copiar
                </Button>
              </div>
            </div>
          ) : null}
          {awaiting.invoiceUrl ? (
            <Button asChild variant="outline" className="w-full">
              <a href={awaiting.invoiceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Pagar com cartão
              </a>
            </Button>
          ) : null}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Esperando o pagamento.
          </p>
          {browserPaymentsTestMode() ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              disabled={simulate.isPending}
              onClick={() =>
                simulate.mutate(awaiting.id, {
                  onSuccess: (res) => {
                    if (res.isPaid) {
                      toast.success(`${planName(target.tier)} ativado.`);
                      onClose();
                    } else toast.error("O pagamento ainda não foi confirmado.");
                  },
                  onError: (error) => toast.error(getErrorMessage(error, "Não foi possível simular o pagamento.")),
                })
              }
            >
              <FlaskConical className="size-4" />
              {simulate.isPending ? "Confirmando..." : "Simular pagamento (testes)"}
            </Button>
          ) : null}
        </DialogBody>
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </>
    );
  }

  const quote = preview.data?.quote;
  const confirm = () =>
    change.mutate(target, {
      onSuccess: (start) => {
        if (start.kind === "awaiting_payment") {
          setAwaiting(start.payment);
          return;
        }
        toast.success(
          start.kind === "scheduled" && quote?.kind === "scheduled"
            ? `Troca marcada para ${formatDate(quote.effectiveOn)}.`
            : `${planName(target.tier)} ativado.`,
        );
        onClose();
      },
      onError: (error) => toast.error(getErrorMessage(error, "Não foi possível trocar o plano.")),
    });

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Confira os valores antes de confirmar.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        {preview.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : preview.isError || !quote ? (
          <p className="text-sm text-destructive">{getErrorMessage(preview.error, "Não foi possível calcular a troca.")}</p>
        ) : (
          <QuoteLines quote={quote} target={target} currentTier={preview.data.current.tier} />
        )}
      </DialogBody>
      <DialogFooter className="shrink-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant={target.tier === "free" ? "destructive" : "default"}
          disabled={!quote || quote.kind === "same" || quote.kind === "checkout" || change.isPending}
          onClick={confirm}
        >
          {change.isPending
            ? "Salvando..."
            : quote?.kind === "now" && quote.chargeTodayCents > 0
              ? `Pagar ${formatCents(quote.chargeTodayCents)}`
              : target.tier === "free"
                ? "Voltar ao Grátis"
                : "Confirmar troca"}
        </Button>
      </DialogFooter>
    </>
  );
}

function QuoteLines({
  quote,
  target,
  currentTier,
}: {
  quote: PlanChangeQuote;
  target: PlanTarget;
  currentTier: SubscriptionTier;
}) {
  if (quote.kind === "same") return <p className="text-sm text-muted-foreground">Esse já é o seu plano.</p>;
  if (quote.kind === "checkout") return <p className="text-sm text-muted-foreground">Assine pelo checkout do plano.</p>;
  if (quote.kind === "scheduled") {
    return target.tier === "free" ? (
      <>
        <Line label="Volta ao Grátis em" value={formatDate(quote.effectiveOn)} />
        <p className="text-sm text-muted-foreground">
          Até lá, o {planName(currentTier)} segue funcionando. Os dados ficam guardados.
        </p>
      </>
    ) : (
      <>
        <Line label={`Muda para o ${planName(target.tier)} em`} value={formatDate(quote.effectiveOn)} />
        <Line label="A partir de então" value={`${formatCents(quote.renewalCents)}${per(target.interval)}`} />
        <p className="text-sm text-muted-foreground">Até lá, nada muda. Dá para desmarcar antes da data.</p>
      </>
    );
  }
  return (
    <>
      <Line
        label="Hoje"
        value={formatCents(quote.chargeTodayCents)}
        hint={
          quote.restartsCycle
            ? `o anual menos ${quote.remainingDays} ${quote.remainingDays === 1 ? "dia" : "dias"} que sobram do mês`
            : `${quote.remainingDays} ${quote.remainingDays === 1 ? "dia" : "dias"} de diferença`
        }
      />
      <Line label={`A partir de ${formatDate(quote.renewsOn)}`} value={`${formatCents(quote.renewalCents)}${per(quote.renewalInterval)}`} />
      <p className="text-sm text-muted-foreground">O {planName(target.tier)} liga assim que o pagamento cair.</p>
    </>
  );
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground break-words">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold">{value}</p>
    </div>
  );
}
