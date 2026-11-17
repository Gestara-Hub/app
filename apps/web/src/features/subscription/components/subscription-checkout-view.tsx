"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
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
  Smartphone,
  Sparkles,
  Ticket,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { SubscriptionInterval } from "@gestarahub/contracts";
import { formatDate } from "@gestarahub/core/format";
import { brazilNationalDigits } from "@gestarahub/core/phone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AddressFields } from "@/components/form";
import { FieldShell, fieldAria } from "@/components/form/field-shell";
import { useCurrentUser } from "@/features/auth";
import { useOrganization, useUnit } from "@/features/settings";
import { subscriptionTierLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { browserPaymentsTestMode } from "@/lib/payments-test-mode";
import { useSubscriptionCheckout } from "../hooks/use-subscription-checkout";
import {
  subscriptionCheckoutSchema,
  type SubscriptionCheckoutFormValues,
} from "../subscription-checkout-schema";
import { logWarn } from "@/lib/log";
import { usePaymentPolling } from "@/hooks/use-payment-polling";

function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function maskCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

export function SubscriptionCheckoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lê parâmetros da URL (?tier=pro|scale & ?interval=monthly|yearly)
  const paramTier = searchParams.get("tier");
  const initialTier: "pro" | "scale" = paramTier === "scale" ? "scale" : "pro";

  const paramInterval = searchParams.get("interval");
  const initialInterval: SubscriptionInterval =
    paramInterval === "yearly" ? "yearly" : "monthly";

  const currentUser = useCurrentUser();
  const { data: organization } = useOrganization();
  const { data: unit } = useUnit();
  const { createSession, simulatePayment, checkStatus } =
    useSubscriptionCheckout();

  // Estados principais
  const [selectedTier, setSelectedTier] = useState<"pro" | "scale">(initialTier);
  const [interval, setInterval] = useState<SubscriptionInterval>(initialInterval);
  const [billingType, setBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [step, setStep] = useState<"config" | "pix_awaiting" | "success">("config");

  // React Hook Form com Zod Resolver
  const form = useForm<SubscriptionCheckoutFormValues>({
    resolver: zodResolver(subscriptionCheckoutSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      customerName: organization?.name || currentUser.name || "",
      customerEmail: currentUser.email || "",
      customerCpfCnpj: "",
      customerPhone: "",
      address: { postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" },
      billingType: "PIX",
      cardNumber: "",
      cardHolder: "",
      cardExpiry: "",
      cardCvv: "",
    },
  });

  const handleSetBillingType = (type: "PIX" | "CREDIT_CARD") => {
    setBillingType(type);
    form.setValue("billingType", type, {
      shouldValidate: form.formState.isSubmitted,
    });
    if (type === "PIX") {
      form.clearErrors(["cardNumber", "cardHolder", "cardExpiry", "cardCvv"]);
    }
  };

  useEffect(() => {
    if (organization?.name && !form.getValues("customerName")) {
      form.setValue("customerName", organization.name);
    }
    if (currentUser?.email && !form.getValues("customerEmail")) {
      form.setValue("customerEmail", currentUser.email);
    }
  }, [organization?.name, currentUser?.email, form]);

  // Endereco e telefone do espaco (Configuracoes > Geral) ja preenchidos: a
  // pessoa so confere. resetField (nao setValue): o valor sugerido nao conta
  // como edicao, e a chegada tardia da unidade ainda preenche (doc 07 §2.8).
  const unitAddress = typeof unit?.address === "object" ? unit.address : undefined;
  useEffect(() => {
    if (!unitAddress || form.getFieldState("address").isDirty) return;
    form.resetField("address", {
      defaultValue: {
        postalCode: unitAddress.postalCode ?? "",
        street: unitAddress.street ?? "",
        number: unitAddress.number ?? "",
        complement: unitAddress.complement ?? "",
        neighborhood: unitAddress.neighborhood ?? "",
        city: unitAddress.city ?? "",
        state: unitAddress.state ?? "",
      },
    });
  }, [unitAddress, form]);
  const unitPhone = unit?.phone;
  useEffect(() => {
    if (!unitPhone || form.getFieldState("customerPhone").isDirty || form.getValues("customerPhone")) return;
    form.resetField("customerPhone", { defaultValue: maskPhone(brazilNationalDigits(unitPhone) ?? "") });
  }, [unitPhone, form]);

  // Estado do Pix gerado no Asaas
  const [pixData, setPixData] = useState<{
    subscriptionId: string;
    paymentId?: string;
    encodedImage: string;
    payload: string;
  } | null>(null);

  // Confere o Pix enquanto aguarda o pagamento (pausa com a aba escondida).
  usePaymentPolling(async () => {
    if (!pixData?.paymentId) return true;
    try {
      const res = await checkStatus(pixData.paymentId);
      if (!res.isPaid) return false;
      setStep("success");
      toast.success("Pagamento confirmado.");
      return true;
    } catch (err) {
      logWarn("[SubscriptionCheckout] Erro no polling de status:", err);
      return false;
    }
  }, step === "pix_awaiting" && Boolean(pixData?.paymentId));

  // Preço e economia do plano selecionado
  const isYearly = interval === "yearly";
  const planName = selectedTier === "pro" ? "Profissional" : "Expansão";

  const monthlyDisplay =
    selectedTier === "pro"
      ? isYearly
        ? "R$ 66,58"
        : "R$ 79,90"
      : isYearly
        ? "R$ 165,83"
        : "R$ 199,00";

  const totalCharged =
    selectedTier === "pro"
      ? isYearly
        ? "R$ 799,00"
        : "R$ 79,90"
      : isYearly
        ? "R$ 1.990,00"
        : "R$ 199,00";

  const savingsNotice =
    selectedTier === "pro"
      ? "Economize R$ 159,80 no plano anual (2 meses grátis)"
      : "Economize R$ 398,00 no plano anual (2 meses grátis)";

  const handleStartCheckout = async (values: SubscriptionCheckoutFormValues) => {
    const cleanDoc = values.customerCpfCnpj.replace(/\D/g, "");

    let creditCardPayload:
      | {
          holderName: string;
          number: string;
          expiryMonth: string;
          expiryYear: string;
          ccv: string;
        }
      | undefined;

    if (values.billingType === "CREDIT_CARD") {
      const cleanCard = (values.cardNumber || "").replace(/\D/g, "");
      const parts = (values.cardExpiry || "").split("/");
      creditCardPayload = {
        holderName: (values.cardHolder || "").trim(),
        number: cleanCard,
        expiryMonth: (parts[0] || "").trim().padStart(2, "0"),
        expiryYear:
          (parts[1] || "").trim().length === 2
            ? `20${(parts[1] || "").trim()}`
            : (parts[1] || "").trim(),
        ccv: (values.cardCvv || "").trim(),
      };
    }

    try {
      const result = await createSession.mutateAsync({
        tier: selectedTier,
        interval,
        billingType: values.billingType,
        customer: {
          name: values.customerName.trim(),
          email: values.customerEmail.trim(),
          cpfCnpj: cleanDoc,
          phone: values.customerPhone?.trim(),
          address: {
            postalCode: values.address.postalCode.replace(/\D/g, ""),
            street: values.address.street.trim(),
            number: values.address.number.trim(),
            complement: values.address.complement?.trim() || undefined,
            neighborhood: values.address.neighborhood.trim(),
            city: values.address.city?.trim() || undefined,
            state: values.address.state?.trim() || undefined,
          },
        },
        creditCard: creditCardPayload,
      });

      if (!result.success) {
        toast.error(result.error || "Não foi possível gerar a assinatura.");
        return;
      }

      if (values.billingType === "CREDIT_CARD") {
        setStep("success");
        toast.success(
          `Plano ${subscriptionTierLabel(selectedTier)} ativado com sucesso!`,
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
        tier: selectedTier,
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

  // Se o pagamento foi concluído com sucesso, exibe a tela de confirmação
  if (step === "success") {
    return (
      <div className="max-w-2xl mx-auto py-4 sm:py-8">
        <Card className="rounded-2xl border bg-card shadow-xl p-4 sm:p-6 md:p-8 space-y-6">
          {/* Header de celebração */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-linear-to-b from-emerald-500/20 to-emerald-500/5 text-emerald-500 border border-emerald-500/30 ring-8 ring-emerald-500/5 shadow-inner">
              <Sparkles className="size-8 text-emerald-500" />
            </div>

            <div className="space-y-1">
              <Badge
                variant="outline"
                className="text-xs px-3 py-0.5 font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                Assinatura confirmada
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Plano {planName} ativado!
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                Tudo pronto! Seu espaço agora conta com todos os recursos e automações avançadas do GestaraHub.
              </p>
            </div>
          </div>

          {/* Destaque para o Próximo Passo: WhatsApp oficial */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs mt-0.5">
                <Smartphone className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-foreground">Próximo passo recomendado</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-semibold text-primary">
                    300 mensagens/mês
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                  Conecte o número do seu espaço para que cobranças, avisos de aula e boas-vindas saiam sozinhos pelo WhatsApp oficial.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => router.push("/communication?tab=connection")}
              size="sm"
              className="w-full sm:w-auto shrink-0 font-bold text-xs gap-1.5 shadow-xs"
            >
              Conectar agora
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          {/* Grid com outros benefícios liberados */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
              Outros superpoderes liberados:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Zap className="size-4" />
                </div>
                <p className="text-xs font-bold text-foreground">Taxa de R$ 1,29 no Pix</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Economia direta em todas as mensalidades e cobranças pagas online.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="size-4" />
                </div>
                <p className="text-xs font-bold text-foreground">Relatórios Gerenciais</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Acompanhamento mensal de inadimplência, retenção de alunos e DRE.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Crown className="size-4" />
                </div>
                <p className="text-xs font-bold text-foreground">Certificados em PDF</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Emissão de diplomas oficiais com código de validação para cursos.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Ticket className="size-4" />
                </div>
                <p className="text-xs font-bold text-foreground">Inscrição em evento por link</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  A pessoa se inscreve sozinha, recebe o ingresso e entra pelo QR code.
                </p>
              </div>
            </div>
          </div>

          {/* Rodapé de navegação */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-border/60">
            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto px-6 font-bold text-xs"
            >
              Ir para o painel principal
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/plans")}
              className="w-full sm:w-auto px-6 font-semibold text-xs"
            >
              Ver detalhes do plano
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentSub = organization?.subscription;
  const isAlreadyActive =
    currentSub?.status === "active" && currentSub.tier !== "free";

  if (isAlreadyActive && step === "config") {
    return (
      <div className="max-w-xl mx-auto py-4 sm:py-8 text-center">
        <Card className="rounded-2xl border bg-card p-4 sm:p-6 md:p-8 shadow-sm space-y-5">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="space-y-1.5">
            <Badge
              variant="outline"
              className="text-xs px-3 py-1 font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1"
            >
              Plano em uso
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Você já possui o Plano {subscriptionTierLabel(currentSub.tier)}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              Sua assinatura está ativa e com todos os recursos liberados.
              {currentSub.renewsOn || currentSub.nextDueDate ? (
                <> A próxima renovação está prevista para <strong>{formatDate(currentSub.renewsOn || currentSub.nextDueDate!)}</strong>.</>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto px-6 font-bold text-xs"
            >
              Ir para o painel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/plans")}
              className="w-full sm:w-auto px-6 font-semibold text-xs"
            >
              Gerenciar plano
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Botão Voltar */}
      <div>
        <Button
          asChild
          variant="ghost"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link href="/plans">
            <ArrowLeft className="size-4" />
            <span>Voltar para os planos</span>
          </Link>
        </Button>
      </div>

      {/* Grid Principal 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: FORMULÁRIO DE CHECKOUT OU PIX (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {step === "config" && (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 pb-1">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                    {selectedTier === "scale" ? (
                      <Crown className="size-4" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </span>
                  <CardTitle className="text-2xl font-bold tracking-tight">
                    Finalizar assinatura
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Preencha os dados para ativar o plano. O pagamento é feito com o parceiro de pagamentos.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <FormProvider {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleStartCheckout)}
                    noValidate
                    className="space-y-6"
                  >
                    {/* Plano escolhido: Profissional ou Expansão */}
                    <div className="space-y-2.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Plano escolhido
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedTier("pro")}
                          className={cn(
                            "flex items-start justify-between rounded-xl border p-3.5 text-left transition-all",
                            selectedTier === "pro"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/70 hover:border-border bg-card",
                          )}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <span>Profissional</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {interval === "monthly" ? "R$ 79,90/mês" : "R$ 66,58/mês (anual)"}
                            </p>
                          </div>
                          {selectedTier === "pro" && (
                            <Check className="size-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedTier("scale")}
                          className={cn(
                            "flex items-start justify-between rounded-xl border p-3.5 text-left transition-all",
                            selectedTier === "scale"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/70 hover:border-border bg-card",
                          )}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <span>Expansão</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {interval === "monthly" ? "R$ 199,00/mês" : "R$ 165,83/mês (anual)"}
                            </p>
                          </div>
                          {selectedTier === "scale" && (
                            <Check className="size-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Seletor Mensal / Anual */}
                    <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Ciclo de cobrança
                          </p>
                          <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-2xl font-extrabold text-foreground tracking-tight">
                              {monthlyDisplay}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              / mês
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => setInterval("monthly")}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
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
                              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
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
                                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40"
                                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/20",
                              )}
                            >
                              2 meses grátis
                            </span>
                          </button>
                        </div>
                      </div>

                      {isYearly && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
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
                          onClick={() => handleSetBillingType("PIX")}
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
                          onClick={() => handleSetBillingType("CREDIT_CARD")}
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

                    {/* Dados de Faturamento */}
                    <div className="space-y-3.5 rounded-xl border border-border/70 p-4 bg-muted/10">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-primary" />
                        <span>Dados de cobrança</span>
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Controller
                          control={form.control}
                          name="customerName"
                          render={({ field, fieldState }) => (
                            <FieldShell
                              id="custName"
                              label="Razão social ou nome do titular"
                              error={fieldState.error?.message}
                              required
                            >
                              <Input
                                id="custName"
                                placeholder="Ex: Studio Viva Bem Ltda"
                                className="text-base md:text-sm"
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                {...fieldAria("custName", fieldState.error?.message)}
                              />
                            </FieldShell>
                          )}
                        />

                        <Controller
                          control={form.control}
                          name="customerEmail"
                          render={({ field, fieldState }) => (
                            <FieldShell
                              id="custEmail"
                              label="E-mail para Recibos e Faturas"
                              error={fieldState.error?.message}
                              required
                            >
                              <Input
                                id="custEmail"
                                type="email"
                                placeholder="financeiro@empresa.com"
                                className="text-base md:text-sm"
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                {...fieldAria("custEmail", fieldState.error?.message)}
                              />
                            </FieldShell>
                          )}
                        />

                        <Controller
                          control={form.control}
                          name="customerCpfCnpj"
                          render={({ field, fieldState }) => (
                            <FieldShell
                              id="custDoc"
                              label="CNPJ ou CPF do Pagador"
                              error={fieldState.error?.message}
                              required
                            >
                              <Input
                                id="custDoc"
                                placeholder="00.000.000/0001-00"
                                maxLength={18}
                                className="text-base md:text-sm font-mono"
                                value={field.value}
                                onChange={(e) =>
                                  field.onChange(maskCpfCnpj(e.target.value))
                                }
                                onBlur={field.onBlur}
                                ref={field.ref}
                                {...fieldAria("custDoc", fieldState.error?.message)}
                              />
                            </FieldShell>
                          )}
                        />

                        <Controller
                          control={form.control}
                          name="customerPhone"
                          render={({ field, fieldState }) => (
                            <FieldShell
                              id="custPhone"
                              label="WhatsApp para Avisos"
                              error={fieldState.error?.message}
                              required={billingType === "CREDIT_CARD"}
                            >
                              <Input
                                id="custPhone"
                                placeholder="(11) 99999-9999"
                                maxLength={15}
                                className="text-base md:text-sm"
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(maskPhone(e.target.value))
                                }
                                onBlur={field.onBlur}
                                ref={field.ref}
                                {...fieldAria("custPhone", fieldState.error?.message)}
                              />
                            </FieldShell>
                          )}
                        />
                      </div>

                      {/* Endereco do pagador: vai na nota fiscal e no pagamento por cartao. */}
                      <div className="space-y-3 border-t border-border/60 pt-3.5">
                        <p className="text-sm font-medium text-foreground">Endereço de cobrança</p>
                        <AddressFields<SubscriptionCheckoutFormValues>
                          prefix="address"
                          required
                          cityStateRequired={false}
                          disabled={createSession.isPending}
                        />
                      </div>
                    </div>

                    {/* Campos de Cartão de Crédito */}
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
                          <Controller
                            control={form.control}
                            name="cardNumber"
                            render={({ field, fieldState }) => (
                              <FieldShell
                                id="cardNumber"
                                label="Número do Cartão"
                                error={fieldState.error?.message}
                                required
                              >
                                <Input
                                  id="cardNumber"
                                  placeholder="0000 0000 0000 0000"
                                  maxLength={19}
                                  className="text-base md:text-sm font-mono"
                                  value={field.value || ""}
                                  onChange={(e) =>
                                    field.onChange(maskCardNumber(e.target.value))
                                  }
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  {...fieldAria("cardNumber", fieldState.error?.message)}
                                />
                              </FieldShell>
                            )}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <Controller
                                control={form.control}
                                name="cardHolder"
                                render={({ field, fieldState }) => (
                                  <FieldShell
                                    id="cardHolder"
                                    label="Nome no Cartão"
                                    error={fieldState.error?.message}
                                    required
                                  >
                                    <Input
                                      id="cardHolder"
                                      placeholder="NOME COMO NO CARTÃO"
                                      className="text-base md:text-sm uppercase"
                                      value={field.value || ""}
                                      onChange={(e) =>
                                        field.onChange(e.target.value.toUpperCase())
                                      }
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                      {...fieldAria("cardHolder", fieldState.error?.message)}
                                    />
                                  </FieldShell>
                                )}
                              />
                            </div>

                            <Controller
                              control={form.control}
                              name="cardExpiry"
                              render={({ field, fieldState }) => (
                                <FieldShell
                                  id="cardExpiry"
                                  label="Validade (MM/AA)"
                                  error={fieldState.error?.message}
                                  required
                                >
                                  <Input
                                    id="cardExpiry"
                                    placeholder="12/28"
                                    maxLength={5}
                                    className="text-base md:text-sm font-mono"
                                    value={field.value || ""}
                                    onChange={(e) =>
                                      field.onChange(maskCardExpiry(e.target.value))
                                    }
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    {...fieldAria("cardExpiry", fieldState.error?.message)}
                                  />
                                </FieldShell>
                              )}
                            />

                            <Controller
                              control={form.control}
                              name="cardCvv"
                              render={({ field, fieldState }) => (
                                <FieldShell
                                  id="cardCvv"
                                  label="CVV"
                                  error={fieldState.error?.message}
                                  required
                                >
                                  <Input
                                    id="cardCvv"
                                    type="password"
                                    placeholder="123"
                                    maxLength={4}
                                    className="text-base md:text-sm font-mono"
                                    value={field.value || ""}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value.replace(/\D/g, "").slice(0, 4),
                                      )
                                    }
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    {...fieldAria("cardCvv", fieldState.error?.message)}
                                  />
                                </FieldShell>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ação de Submissão */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Pagamento seguro com o parceiro de pagamentos.</span>
                      </div>

                      <Button
                        type="submit"
                        disabled={createSession.isPending}
                        className="w-full sm:w-auto font-bold text-xs gap-2 px-6 shadow-sm"
                      >
                        {createSession.isPending ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            <span>Processando o pagamento...</span>
                          </>
                        ) : billingType === "PIX" ? (
                          <>
                            <span>Gerar Código Pix ({totalCharged})</span>
                            <ArrowRight className="size-4" />
                          </>
                        ) : (
                          <>
                            <span>Confirmar e Ativar ({totalCharged})</span>
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </FormProvider>
              </CardContent>
            </Card>
          )}

          {/* MODO PIX: AGUARDANDO PAGAMENTO */}
          {step === "pix_awaiting" && pixData && (
            <Card className="rounded-2xl border bg-card shadow-sm p-6 sm:p-8 space-y-6">
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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 p-6 rounded-xl border border-border/80 bg-muted/20">
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-xl border-2 border-primary/40 bg-white p-3 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${pixData.encodedImage}`}
                      alt="QR Code Pix"
                      className="size-48 sm:size-52 object-contain"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <QrCode className="size-3" />
                    QR Code do Pix
                  </span>
                </div>

                <div className="flex-1 space-y-4 max-w-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">
                      Valor da Assinatura:
                    </p>
                    <p className="text-3xl font-extrabold text-foreground tracking-tight">
                      {totalCharged}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                        onClick={handleCopyPix}
                        className="absolute right-1 top-1 h-7 text-[11px] gap-1 font-bold shadow-2xs"
                      >
                        <Copy className="size-3" />
                        <span>Copiar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Verificando o recebimento...</span>
                  </div>
                </div>
              </div>

              {/* Simular o pagamento: so com o Asaas de testes (lib/payments-test-mode) */}
              {browserPaymentsTestMode() ? (
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
              ) : null}

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("config")}
                  className="text-xs"
                >
                  Voltar e alterar dados
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="text-xs"
                >
                  <Link href="/plans">
                    Cancelar e sair
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* COLUNA DIREITA: RESUMO DO PEDIDO STICKY (lg:col-span-5) */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Resumo do pedido
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-bold px-2.5 py-1 border shadow-xs",
                    selectedTier === "pro"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                  )}
                >
                  {planName} · {isYearly ? "Anual" : "Mensal"}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold pt-1">
                Plano {planName}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedTier === "pro"
                  ? "Lembretes no WhatsApp sem clique, relatórios e certificados."
                  : "WhatsApp, multiunidades, taxa reduzida e atendimento prioritário."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <Separator />

              {/* Valores */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Mensalidade base</span>
                  <span className="font-semibold text-foreground">
                    {monthlyDisplay} / mês
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Periodicidade</span>
                  <span>{isYearly ? "Cobrança anual" : "Cobrança mensal"}</span>
                </div>

                {isYearly && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Desconto (2 meses grátis)</span>
                    <span>{selectedTier === "pro" ? "- R$ 159,80" : "- R$ 398,00"}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-baseline pt-1">
                <div>
                  <p className="text-xs font-bold text-foreground">Total hoje</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isYearly ? "Faturamento anual à vista" : "Primeira mensalidade"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-foreground tracking-tight">
                    {totalCharged}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Lista de Recursos Inclusos */}
              <div className="space-y-2.5 pt-1">
                <p className="font-semibold text-foreground">
                  O que a assinatura inclui:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  {selectedTier === "pro" ? (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Taxa menor no Pix</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>WhatsApp automático (lembretes e avisos)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Relatório do resultado do mês e retenção</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Certificado de conclusão em PDF</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Inscrição em evento por link, com ingresso</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Tudo do Profissional</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>1.000 mensagens no WhatsApp por mês</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Multiunidades e filiais da rede</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Taxa reduzida de pagamento online</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span>Suporte e atendimento prioritário</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Garantias */}
              <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 border border-border/60 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>Sem fidelidade: cancele quando quiser</span>
                </div>
                <p>
                  Você pode pausar, cancelar ou trocar de plano a qualquer momento sem taxas de rescisão.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
