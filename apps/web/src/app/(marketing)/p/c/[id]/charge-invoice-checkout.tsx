"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  CheckCircle2,
  Clock,
  CreditCard,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { OnlinePaymentMethod } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { formatCpf, isValidCpf } from "@gestarahub/core/payer";
import { PixQrCode } from "@/components/shared/pix-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ChargeInvoiceView } from "@/services/server/paymentPage";
import {
  checkPublicChargeStatusAction,
  createPublicChargePaymentAction,
} from "@/services/server/chargeInvoiceActions";
import { CopyPixButton } from "../../[code]/copy-pix-button";

const METHOD_DETAILS: Record<
  string,
  { label: string; description: string; icon: typeof QrCode }
> = {
  pix: {
    label: "Pix",
    description: "Aprovação instantânea via QR Code ou Copia e Cola.",
    icon: QrCode,
  },
  link: {
    label: "Cartão de crédito",
    description: "Pague com segurança em poucos segundos.",
    icon: CreditCard,
  },
  boleto: {
    label: "Boleto bancário",
    description: "Compensação em até 1 dia útil.",
    icon: Barcode,
  },
};

export function ChargeInvoiceCheckout({ invoice }: { invoice: ChargeInvoiceView }) {
  const [selectedMethod, setSelectedMethod] = useState<OnlinePaymentMethod>(() => {
    if (invoice.existingPayment) return invoice.existingPayment.method;
    if (invoice.acceptedMethods.includes("pix")) return "pix";
    return invoice.acceptedMethods[0] || "pix";
  });

  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState(invoice.existingPayment ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(invoice.state === "paid");

  // Polling para detectar pagamento enquanto houver Pix ativo aguardando
  const checkStatus = useCallback(async () => {
    if (isPaid) return;
    try {
      const res = await checkPublicChargeStatusAction(invoice.chargeId);
      if (res.status === "paid") {
        setIsPaid(true);
      }
    } catch {}
  }, [invoice.chargeId, isPaid]);

  useEffect(() => {
    if (isPaid || !activePayment || activePayment.method !== "pix") return;
    const interval = setInterval(checkStatus, 3500);
    return () => clearInterval(interval);
  }, [activePayment, checkStatus, isPaid]);

  const handleGeneratePayment = async () => {
    setErrorMessage(null);
    setCpfError(null);

    // Validação de CPF caso não cadastrado
    if (!invoice.hasPayerCpf) {
      if (!cpf.trim()) {
        setCpfError("Informe o CPF para prosseguir com o pagamento.");
        return;
      }
      if (!isValidCpf(cpf)) {
        setCpfError("CPF inválido. Confira os números digitados.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createPublicChargePaymentAction({
        chargeId: invoice.chargeId,
        method: selectedMethod as "pix" | "link" | "boleto",
        cpf: !invoice.hasPayerCpf ? cpf : undefined,
      });

      if (!res.ok) {
        setErrorMessage(res.error || "Não foi possível gerar a forma de pagamento.");
        setIsSubmitting(false);
        return;
      }

      if (res.method === "pix" && res.pixCopyPaste) {
        setActivePayment({
          method: "pix",
          pixCopyPaste: res.pixCopyPaste,
          expiresAt: res.expiresAt || "",
          amountCents: res.amountCents,
        });
      } else if (res.linkUrl) {
        window.location.href = res.linkUrl;
        return;
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao conectar com o serviço de pagamentos.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Tela de Sucesso / Já pago
  if (isPaid || invoice.state === "paid") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Pagamento Confirmado!
          </h2>
          <p className="text-sm text-muted-foreground">
            Sua mensalidade na <strong className="font-semibold text-foreground">{invoice.organizationName}</strong> já consta como quitada.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
          <p>
            Aluno: <strong className="text-foreground">{invoice.studentName}</strong>
          </p>
          <p>
            Referência: <strong className="text-foreground">{invoice.label}</strong>
          </p>
        </div>
      </div>
    );
  }

  // 2. Tela de Pix Gerado (QR Code + Copia e Cola)
  if (activePayment?.pixCopyPaste) {
    // O valor do proprio codigo: o Pix pode ter sido gerado com outra regra de repasse.
    const formattedAmount = formatCents(
      activePayment.amountCents ?? invoice.amountsByMethod.pix ?? invoice.amountCents,
    );

    return (
      <div className="space-y-5">
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {invoice.organizationName}
          </p>
          <h2 className="text-lg font-bold text-foreground">{invoice.label}</h2>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">
            {formattedAmount}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="size-52 rounded-2xl border-2 border-primary/20 bg-white p-3 shadow-sm">
            <PixQrCode value={activePayment.pixCopyPaste} />
          </div>
          <p className="text-center text-xs text-muted-foreground max-w-xs">
            Abra o app do seu banco, escolha <strong>Pix</strong> e escaneie o QR Code ou utilize o código Copia e Cola abaixo:
          </p>
        </div>

        <div className="space-y-2">
          <p className="break-all rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground select-all">
            {activePayment.pixCopyPaste}
          </p>
          <CopyPixButton code={activePayment.pixCopyPaste} />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Clock className="size-3.5" />
          <span>Aguardando identificação do pagamento...</span>
        </div>

        <div className="pt-2 border-t border-border/60 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActivePayment(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Escolher outra forma de pagamento
          </Button>
        </div>
      </div>
    );
  }

  // 3. Tela de Escolha de Método e Preenchimento de CPF
  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          {invoice.organizationName}
        </p>
        <h2 className="text-lg font-bold text-foreground">{invoice.label}</h2>
        <p className="text-3xl font-extrabold tracking-tight text-foreground">
          {formatCents(invoice.amountCents)}
        </p>
        <p className="text-xs text-muted-foreground">
          Aluno: <strong className="text-foreground">{invoice.studentName}</strong> · Vence em {invoice.dueDate.split("-").reverse().join("/")}
        </p>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Campo de CPF caso ainda não esteja cadastrado */}
      {!invoice.hasPayerCpf ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <ShieldCheck className="size-4 shrink-0" />
            <p className="text-xs font-semibold">Identificação obrigatória para emissão</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            As normas do Banco Central exigem o CPF do pagador para emissão de cobranças oficiais.
          </p>
          <div className="space-y-1">
            <Label htmlFor="payer-cpf" className="text-xs font-medium text-foreground">
              CPF do Pagador
            </Label>
            <Input
              id="payer-cpf"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                setCpf(formatCpf(e.target.value));
                if (cpfError) setCpfError(null);
              }}
              className={cn("bg-background text-sm font-mono", cpfError && "border-destructive")}
              maxLength={14}
            />
            {cpfError ? (
              <p className="text-[11px] font-medium text-destructive">{cpfError}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Pagador: <strong className="font-semibold text-foreground">{invoice.payerName}</strong>
          </span>
          {invoice.payerCpfMasked ? (
            <span className="font-mono text-muted-foreground">
              CPF: {invoice.payerCpfMasked}
            </span>
          ) : null}
        </div>
      )}

      {/* Opções de métodos de pagamento */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Escolha como pagar:
        </p>

        <div className="grid gap-2">
          {invoice.acceptedMethods.map((m) => {
            const details = METHOD_DETAILS[m] || {
              label: m,
              description: "",
              icon: QrCode,
            };
            const Icon = details.icon;
            const isSelected = selectedMethod === m;
            const amountForMethod = invoice.amountsByMethod[m] ?? invoice.amountCents;
            const hasFeeDifference = amountForMethod !== invoice.amountCents;

            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMethod(m)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                    : "border-border hover:border-foreground/30 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {details.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {details.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {formatCents(amountForMethod)}
                  </p>
                  {hasFeeDifference ? (
                    <span className="text-[10px] text-muted-foreground">
                      com taxa
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        disabled={isSubmitting}
        onClick={handleGeneratePayment}
        className="w-full gap-2 text-sm font-semibold h-11"
      >
        {isSubmitting ? (
          "Gerando pagamento..."
        ) : selectedMethod === "pix" ? (
          <>
            Gerar Pix para pagar
            <ArrowRight className="size-4" />
          </>
        ) : selectedMethod === "link" ? (
          <>
            Pagar com Cartão
            <ArrowRight className="size-4" />
          </>
        ) : (
          <>
            Gerar Boleto
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </div>
  );
}
