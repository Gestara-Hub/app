"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  FlaskConical,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionInterval } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { subscriptionTierLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useSubscriptionCheckout } from "../hooks/use-subscription-checkout";

interface SubscriptionCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTier: "pro" | "scale";
  initialInterval?: SubscriptionInterval;
}

interface SubscriptionCheckoutContentProps {
  targetTier: "pro" | "scale";
  initialInterval: SubscriptionInterval;
  onClose: () => void;
}

function SubscriptionCheckoutContent({
  targetTier,
  initialInterval,
  onClose,
}: SubscriptionCheckoutContentProps) {
  const currentUser = useCurrentUser();
  const { data: organization } = useOrganization();
  const { createSession, simulatePayment, checkStatus } =
    useSubscriptionCheckout();

  const [interval, setInterval] = useState<SubscriptionInterval>(initialInterval);
  const [billingType, setBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [step, setStep] = useState<"config" | "pix_awaiting" | "success">("config");

  // Form Fields iniciados diretamente
  const [customerName, setCustomerName] = useState(
    organization?.name || currentUser.name || "",
  );
  const [customerEmail, setCustomerEmail] = useState(currentUser.email || "");
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Credit Card Fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Pix Result State
  const [pixData, setPixData] = useState<{
    subscriptionId: string;
    paymentId?: string;
    encodedImage: string;
    payload: string;
  } | null>(null);

  // Polling automático no Pix enquanto aguarda pagamento
  useEffect(() => {
    if (step !== "pix_awaiting" || !pixData?.paymentId) return;

    const intervalId = window.setInterval(async () => {
      try {
        const res = await checkStatus(pixData.paymentId!);
        if (res.isPaid) {
          window.clearInterval(intervalId);
          setStep("success");
          toast.success("Pagamento confirmado via Asaas!");
        }
      } catch (err) {
        console.warn("[SubscriptionCheckout] Erro no polling de status:", err);
      }
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [step, pixData?.paymentId, checkStatus]);

  // Preço e economia do plano selecionado
  const isYearly = interval === "yearly";
  const planName = targetTier === "pro" ? "Profissional" : "Expansão";
  const monthlyDisplay =
    targetTier === "pro"
      ? isYearly
        ? "R$ 66,58"
        : "R$ 79,90"
      : isYearly
        ? "R$ 165,83"
        : "R$ 199,00";

  const totalCharged =
    targetTier === "pro"
      ? isYearly
        ? "R$ 799,00"
        : "R$ 79,90"
      : isYearly
        ? "R$ 1.990,00"
        : "R$ 199,00";

  const savingsNotice =
    targetTier === "pro"
      ? "Economize R$ 159,80 no plano anual (2 meses grátis)"
      : "Economize R$ 398,00 no plano anual (2 meses grátis)";

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error("Por favor, informe seu nome e e-mail.");
      return;
    }

    const cleanDoc = customerCpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length < 11) {
      toast.error("Informe um CPF ou CNPJ válido para a emissão da cobrança.");
      return;
    }

    let creditCardPayload:
      | {
          holderName: string;
          number: string;
          expiryMonth: string;
          expiryYear: string;
          ccv: string;
        }
      | undefined;

    if (billingType === "CREDIT_CARD") {
      const cleanCard = cardNumber.replace(/\D/g, "");
      if (cleanCard.length < 13) {
        toast.error("Informe um número de cartão de crédito válido.");
        return;
      }
      const parts = cardExpiry.split("/");
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        toast.error("Informe a validade no formato MM/AA.");
        return;
      }
      creditCardPayload = {
        holderName: cardHolder.trim() || customerName,
        number: cleanCard,
        expiryMonth: parts[0].trim().padStart(2, "0"),
        expiryYear:
          parts[1].trim().length === 2
            ? `20${parts[1].trim()}`
            : parts[1].trim(),
        ccv: cardCvv.trim(),
      };
    }

    try {
      const result = await createSession.mutateAsync({
        tier: targetTier,
        interval,
        billingType,
        customer: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          cpfCnpj: cleanDoc,
          phone: customerPhone.trim(),
        },
        creditCard: creditCardPayload,
      });

      if (!result.success) {
        toast.error(result.error || "Não foi possível gerar a assinatura.");
        return;
      }

      if (billingType === "CREDIT_CARD") {
        setStep("success");
        toast.success(
          `Plano ${subscriptionTierLabel(targetTier)} ativado com sucesso!`,
        );
      } else if (result.pixQrCode) {
        setPixData({
          subscriptionId: result.subscriptionId,
          paymentId: result.paymentId,
          encodedImage: result.pixQrCode.encodedImage,
          payload: result.pixQrCode.payload,
        });
        setStep("pix_awaiting");
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar assinatura.",
      );
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.payload) return;
    navigator.clipboard.writeText(pixData.payload);
    toast.success("Código Pix Copia e Cola copiado para a área de transferência!");
  };

  const handleSimulateSandboxPayment = async () => {
    if (!pixData?.paymentId) return;
    try {
      const res = await simulatePayment.mutateAsync({
        paymentId: pixData.paymentId,
        tier: targetTier,
        interval,
        subscriptionId: pixData.subscriptionId,
      });

      if (res.success) {
        setStep("success");
        toast.success("Pagamento Sandbox liquidado com sucesso!");
      } else {
        toast.error(res.error || "Não foi possível liquidar o pagamento.");
      }
    } catch {
      toast.error("Falha ao simular pagamento.");
    }
  };

  return (
    <>
      {/* Header com branding e plano */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border/80">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                {targetTier === "scale" ? (
                  <Crown className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </span>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {step === "success"
                  ? "Assinatura Confirmada!"
                  : `Ativar Plano ${planName}`}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {step === "success"
                ? "Sua conta já está com acesso ilimitado aos recursos exclusivos."
                : "Finalize a assinatura e libere todos os recursos imediatamente no GestaraHub."}
            </DialogDescription>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "font-bold text-xs px-2.5 py-1 gap-1.5 shadow-2xs",
              targetTier === "pro"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
            )}
          >
            <span>{planName}</span>
            <span>·</span>
            <span>{isYearly ? "Anual" : "Mensal"}</span>
          </Badge>
        </div>
      </div>

      {/* STEP 1: CONFIGURAÇÃO E DADOS */}
      {step === "config" && (
        <form onSubmit={handleStartCheckout} noValidate className="p-6 space-y-6">
          {/* Box do Resumo do Plano e Seletor Mensal / Anual */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Faturamento da Assinatura
                </p>
                <div className="flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {monthlyDisplay}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    / mês
                  </span>
                  <span className="text-xs text-muted-foreground font-normal pl-1">
                    ({totalCharged} {isYearly ? "faturado anualmente" : "faturado ao mês"})
                  </span>
                </div>
              </div>

              {/* Alternador Mensal / Anual */}
              <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setInterval("monthly")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                    !isYearly
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("yearly")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold transition-all flex items-center gap-1.5",
                    isYearly
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Anual</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight transition-colors border",
                      isYearly
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                    )}
                  >
                    2 meses grátis
                  </span>
                </button>
              </div>
            </div>

            {isYearly && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Zap className="size-3.5 shrink-0" />
                <span>{savingsNotice}</span>
              </div>
            )}
          </div>

          {/* Escolha da Forma de Pagamento */}
          <div className="space-y-2.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Forma de Pagamento
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBillingType("PIX")}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  billingType === "PIX"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/70 hover:border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    billingType === "PIX"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  <QrCode className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Pix Automático / QR Code</span>
                    <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.2 font-bold">
                      Imediato
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Geração de QR Code e código Copia e Cola com liberação automática.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBillingType("CREDIT_CARD")}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  billingType === "CREDIT_CARD"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/70 hover:border-border bg-card",
                  )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    billingType === "CREDIT_CARD"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  <CreditCard className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">
                    Cartão de Crédito
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Renovação automática sem comprometer o limite do mês todo.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Dados do Titular / Organização */}
          <div className="space-y-3.5 rounded-xl border border-border/70 p-4 bg-muted/10">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" />
              <span>Dados de Faturamento (GestaraHub / Asaas)</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="custName" className="text-xs">
                  Razão Social ou Nome do Titular *
                </Label>
                <Input
                  id="custName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Studio Viva Bem Ltda"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEmail" className="text-xs">
                  E-mail para Recibos e Faturas *
                </Label>
                <Input
                  id="custEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="financeiro@empresa.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custDoc" className="text-xs">
                  CNPJ ou CPF do Pagador *
                </Label>
                <Input
                  id="custDoc"
                  value={customerCpfCnpj}
                  onChange={(e) => setCustomerCpfCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custPhone" className="text-xs">
                  WhatsApp para Avisos
                </Label>
                <Input
                  id="custPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Campos de Cartão de Crédito (se selecionado) */}
          {billingType === "CREDIT_CARD" && (
            <div className="space-y-3.5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  <span>Dados do Cartão de Crédito</span>
                </p>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  Criptografia PCI-DSS
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cardNumber" className="text-xs">
                    Número do Cartão *
                  </Label>
                  <Input
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-1.5">
                    <Label htmlFor="cardHolder" className="text-xs">
                      Nome no Cartão *
                    </Label>
                    <Input
                      id="cardHolder"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      placeholder="NOME COMO NO CARTÃO"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cardExpiry" className="text-xs">
                      Validade (MM/AA) *
                    </Label>
                    <Input
                      id="cardExpiry"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="12/28"
                      maxLength={5}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cardCvv" className="text-xs">
                      CVV *
                    </Label>
                    <Input
                      id="cardCvv"
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                      maxLength={4}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé com botão de ação e termos */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Processamento oficial e seguro via Gateway Asaas.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={createSession.isPending}
                className="w-full sm:w-auto text-xs font-bold gap-1.5 h-9 px-5 shadow-sm"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Gerando assinatura...</span>
                  </>
                ) : billingType === "PIX" ? (
                  <>
                    <span>Gerar Pix ({totalCharged})</span>
                    <ArrowRight className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Confirmar e Ativar ({totalCharged})</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* STEP 2: AGUARDANDO PIX */}
      {step === "pix_awaiting" && pixData && (
        <div className="p-6 space-y-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <Clock className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-foreground">
                Aguardando confirmação do pagamento
              </p>
              <p className="text-muted-foreground">
                Abra o aplicativo do seu banco, escolha <strong>Pix</strong> e escaneie o QR Code ou utilize o código Copia e Cola abaixo.
                A liberação ocorre automaticamente em poucos segundos após o pagamento.
              </p>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl border border-border/80 bg-muted/20">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl border-2 border-primary/40 bg-white p-3 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${pixData.encodedImage}`}
                  alt="QR Code Pix"
                  className="size-44 sm:size-48 object-contain"
                />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <QrCode className="size-3" />
                QR Code oficial do Asaas
              </span>
            </div>

            <div className="flex-1 space-y-4 max-w-sm">
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">
                  Valor da Assinatura:
                </p>
                <p className="text-2xl font-extrabold text-foreground">
                  {totalCharged}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Plano {planName} ({isYearly ? "Faturamento Anual" : "Faturamento Mensal"})
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Pix Copia e Cola:
                </Label>
                <div className="relative">
                  <Input
                    readOnly
                    value={pixData.payload}
                    className="font-mono text-[11px] h-9 pr-24 bg-muted/60"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyPix}
                    className="absolute right-1 top-1 h-7 text-[11px] gap-1 font-bold shadow-2xs"
                  >
                    <Copy className="size-3" />
                    <span>Copiar</span>
                  </Button>
                </div>
              </div>

              {/* Status animado de verificação */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>Verificando recebimento no Asaas...</span>
              </div>
            </div>
          </div>

          {/* Sandbox Simulation Helper */}
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <FlaskConical className="size-4 text-primary shrink-0" />
              <span className="text-muted-foreground">
                <strong>Ambiente de Homologação (Sandbox):</strong> Quer simular o pagamento imediatamente sem escanear pelo banco?
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSimulateSandboxPayment}
              disabled={simulatePayment.isPending}
              className="text-xs font-bold gap-1.5 h-8 shrink-0 border-primary/40 hover:bg-primary/10 shadow-2xs"
            >
              {simulatePayment.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Confirmando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Simular Pagamento no Asaas</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("config")}
              className="text-xs"
            >
              Voltar e alterar dados
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Fechar janela
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCESSO E ATIVAÇÃO */}
      {step === "success" && (
        <div className="p-8 space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <Check className="size-8 stroke-[3]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Plano {planName} Ativado!
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Parabéns! Sua assinatura foi confirmada com sucesso via gateway Asaas.
              Todos os recursos exclusivos do seu plano já estão desbloqueados na sua conta.
            </p>
          </div>

          {/* Lista dos Recursos Liberados */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-left max-w-lg mx-auto space-y-2.5 text-xs">
            <p className="font-bold text-foreground border-b border-border/60 pb-2">
              O que foi liberado agora mesmo:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span><strong>Taxa Pix Reduzida (R$ 1,29):</strong> mais lucro em cada recebimento.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span><strong>WhatsApp Automático:</strong> cobranças e lembretes enviados sem clique.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span><strong>DRE Gerencial Completa:</strong> controle de lucro real e churn.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span><strong>Certificados em PDF:</strong> emissão oficial e envio aos alunos.</span>
              </li>
              {targetTier === "scale" && (
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span><strong>Multiunidades e BI Preditivo:</strong> gestão de filiais e ocupação em tempo real.</span>
                </li>
              )}
            </ul>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              size="lg"
              onClick={onClose}
              className="w-full sm:w-auto px-8 font-bold text-xs shadow-md"
            >
              Começar a Usar Agora
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function SubscriptionCheckoutDialog({
  open,
  onOpenChange,
  targetTier,
  initialInterval = "monthly",
}: SubscriptionCheckoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border bg-card shadow-2xl">
        {open && (
          <SubscriptionCheckoutContent
            key={`${targetTier}-${initialInterval}`}
            targetTier={targetTier}
            initialInterval={initialInterval}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
