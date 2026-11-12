"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Crown,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useCan, useCurrentUser } from "@/features/auth";
import { useSetSubscriptionTier, useSubscription } from "@/features/settings";
import { formatCents } from "@gestarahub/core/format";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";
import { platformFeeSentence } from "@gestarahub/core/payment-fees";
import { isDemoSpace } from "@/lib/demo";
import { cn } from "@/lib/utils";
import type { PlanTarget } from "@/services/subscription/actions";
import { openSupport } from "@/features/support";
import { PlanChangeDialog } from "./plan-change-dialog";
import { ScheduledPlanChangeNotice } from "./scheduled-plan-change-notice";

export function PlansView() {
  const can = useCan();
  const canManage = can("subscription:manage");
  const { data: sub, isLoading } = useSubscription();
  const setTier = useSetSubscriptionTier();
  const { confirm, dialog } = useConfirmAction();

  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const currentTier = sub?.tier ?? "free";
  const currentInterval = sub?.interval ?? "monthly";
  // Conta real com plano pago: a troca passa pela conta da diferenca (doc product/13 §6).
  const demo = isDemoSpace(useCurrentUser().organizationId);
  // Cortesia do GestaraHub nao e assinatura: o botao leva ao checkout, nao a troca com a conta da diferenca.
  const onCourtesy = Boolean(sub?.courtesyUntil);
  const changesInPlace = !demo && currentTier !== "free" && !onCourtesy;
  const [changeTarget, setChangeTarget] = useState<PlanTarget | null>(null);

  const handleSelectTier = async (targetTier: SubscriptionTier) => {
    if (!canManage) {
      toast.error("Apenas o proprietário da organização pode alterar o plano.");
      return;
    }
    if (targetTier === currentTier) return;
    if (changesInPlace) {
      setChangeTarget({ tier: targetTier, interval });
      return;
    }

    // Downgrade para Free
    const ok = await confirm({
      title: "Voltar ao Plano Grátis?",
      description:
        "Sua assinatura será cancelada e não haverá novas cobranças. Os recursos do Profissional ficam bloqueados. Seus alunos, turmas e dados continuam guardados e voltam quando você assinar de novo.",
      confirmLabel: "Voltar ao Grátis",
      variant: "destructive",
    });

    if (!ok) return;

    setTier.mutate("free", {
      onSuccess: () => {
        toast.success("Plano Grátis ativado. Assinatura cancelada.");
      },
      onError: (err) => {
        toast.error(
          getErrorMessage(err, "Não foi possível atualizar o plano."),
        );
      },
    });
  };

  if (isLoading) {
    return <PlansSkeleton />;
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-10 pb-16">
        <ScheduledPlanChangeNotice subscription={sub} />

        {/* Hero Header */}
        <div className="text-center space-y-3.5 pt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>Planos do GestaraHub</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Escolha o plano do seu espaço
          </h1>

          <p className="max-w-2xl mx-auto text-sm text-muted-foreground sm:text-base leading-relaxed">
            O Grátis cobre o dia a dia. O Profissional automatiza o WhatsApp e libera relatórios e certificados. O Expansão escala sua operação e filiais.
          </p>

          {/* Seletor Mensal / Anual */}
          <div className="pt-2 flex items-center justify-center">
            <div className="flex items-center rounded-full border border-border/80 bg-muted/40 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setInterval("monthly")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  interval === "monthly"
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
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  interval === "yearly"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Anual</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  2 meses grátis
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Grátis, Profissional e Expansão */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {/* Plano Grátis */}
          <Card
            className={cn(
              "flex flex-col justify-between rounded-2xl border transition-all duration-200 relative bg-card shadow-xs",
              currentTier === "free"
                ? "border-primary/50 ring-1 ring-primary/20"
                : "border-border/70 hover:border-border",
            )}
          >
            <div>
              <CardHeader className="pb-4">
                <div className="flex min-h-[22px] items-center justify-between pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Para começar
                  </span>
                  {currentTier === "free" ? (
                    <Badge variant="secondary" className="text-[10px] font-bold text-foreground bg-muted">
                      Seu plano atual
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl font-bold">Grátis</CardTitle>
                <CardDescription className="text-xs">
                  Tudo para tocar o dia a dia do seu espaço, sem mensalidade.
                </CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">R$ 0</span>
                    <span className="text-xs text-muted-foreground font-medium">/ mês</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">Grátis, sem cartão de crédito.</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="font-semibold text-foreground border-b border-border/50 pb-2">Inclui:</p>
                <ul className="space-y-2.5 text-muted-foreground">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">{platformFeeSentence()}</p>
              </CardContent>
            </div>

            <CardFooter className="pt-4">
              <Button
                variant={currentTier === "free" ? "outline" : "secondary"}
                className="w-full text-xs font-semibold"
                disabled={currentTier === "free" || setTier.isPending}
                onClick={() => handleSelectTier("free")}
              >
                {currentTier === "free" ? "Plano atual" : "Voltar ao Grátis"}
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Profissional (destaque) */}
          <Card
            className={cn(
              "flex flex-col justify-between rounded-2xl border-2 transition-all duration-200 relative bg-card shadow-md",
              "border-primary ring-2 ring-primary/20",
            )}
          >
            <div>
              <CardHeader className="pb-4">
                <div className="flex min-h-[22px] items-center justify-between pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Para automatizar</span>
                  {currentTier === "pro" ? (
                    <Badge variant="secondary" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      Seu plano atual
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <span>Profissional</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Lembretes e avisos no WhatsApp sem clique, relatórios do resultado e certificados.
                </CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">
                      {formatCents(SUBSCRIPTION_PRICES.pro[interval].priceCents)}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {interval === "monthly" ? "/ mês" : "/ ano"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    {interval === "monthly" ? "Cobrança mensal, sem fidelidade." : "Cobrança anual, com 2 meses grátis."}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                  Tudo do Grátis, além de:
                </p>
                <ul className="space-y-2.5 text-foreground/90">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="size-4 shrink-0 text-primary mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>

            <CardFooter className="pt-4">
              <PaidPlanAction
                tier="pro"
                interval={interval}
                current={{ tier: onCourtesy ? "free" : currentTier, interval: currentInterval }}
                changesInPlace={changesInPlace}
                canManage={canManage}
                onChange={setChangeTarget}
                checkoutLabel="Assinar o Profissional"
                primary
              />
            </CardFooter>
          </Card>

          {/* Plano Expansão */}
          <Card
            className={cn(
              "flex flex-col justify-between rounded-2xl border transition-all duration-200 relative bg-card shadow-xs",
              currentTier === "scale"
                ? "border-indigo-500/60 ring-2 ring-indigo-500/20"
                : "border-border/70 hover:border-border",
            )}
          >
            <div>
              <CardHeader className="pb-4">
                <div className="flex min-h-[22px] items-center justify-between pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Para crescer
                  </span>
                  {currentTier === "scale" ? (
                    <Badge variant="secondary" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                      Seu plano atual
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <span>Expansão</span>
                  <Crown className="size-4 text-indigo-500" />
                </CardTitle>
                <CardDescription className="text-xs">
                  Para redes, filiais ou operações com alto volume de mensagens e atendimento prioritário.
                </CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">
                      {formatCents(SUBSCRIPTION_PRICES.scale[interval].priceCents)}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {interval === "monthly" ? "/ mês" : "/ ano"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    {interval === "monthly" ? "Cobrança mensal, sem fidelidade." : "Cobrança anual, com 2 meses grátis."}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                  Tudo do Profissional, além de:
                </p>
                <ul className="space-y-2.5 text-muted-foreground">
                  {SCALE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>

            <CardFooter className="pt-4">
              <PaidPlanAction
                tier="scale"
                interval={interval}
                current={{ tier: onCourtesy ? "free" : currentTier, interval: currentInterval }}
                changesInPlace={changesInPlace}
                canManage={canManage}
                onChange={setChangeTarget}
                checkoutLabel="Assinar o Expansão"
              />
            </CardFooter>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Dúvidas sobre os planos?{" "}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => openSupport({ draft: "Tenho uma dúvida sobre os planos: " })}>
            Fale com a gente
          </Button>
        </p>

        {/* Garantia e Segurança */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-muted-foreground bg-muted/20 border border-border/60 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Sem fidelidade: cancele ou altere seu plano quando quiser</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500 shrink-0" />
            <span>Liberação imediata de todos os recursos no mesmo instante</span>
          </div>
        </div>
      </div>

      {dialog}
      <PlanChangeDialog target={changeTarget} onOpenChange={(open) => (!open ? setChangeTarget(null) : undefined)} />
    </>
  );
}

const RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, scale: 2 };

/** So o que o produto faz hoje (decisao de 24/10, achados 17 e 19). */
const FREE_FEATURES = [
  "Alunos e turmas sem limite",
  "Chamada pelo celular",
  "Mensalidades, cursos e pacotes de aulas",
  "Caixa e pagamento de quem dá aula",
  "Cobrança por Pix e cartão online",
  "Repasse da taxa ao aluno, se você quiser",
];

const PRO_FEATURES = [
  "Lembretes e avisos no WhatsApp sem clique",
  "Relatório do resultado do mês",
  "Retenção de alunos",
  "Certificado de conclusão em PDF",
  "Inscrição em evento por link, com ingresso",
  "Taxa menor por Pix pago",
];

const SCALE_FEATURES = [
  "1.000 mensagens no WhatsApp por mês",
  "Multiunidades e filiais da rede",
  "Taxa reduzida de pagamento online",
  "Inteligência analítica preditiva",
  "Suporte e atendimento prioritário",
];

/**
 * Botao do plano pago: "Plano atual" no mesmo plano e periodo; do Gratis (ou na
 * demonstracao), o checkout; com plano pago, a troca com a conta da diferenca.
 */
function PaidPlanAction({
  tier,
  interval,
  current,
  changesInPlace,
  canManage,
  onChange,
  checkoutLabel,
  primary = false,
}: {
  tier: "pro" | "scale";
  interval: "monthly" | "yearly";
  current: { tier: SubscriptionTier; interval: "monthly" | "yearly" };
  changesInPlace: boolean;
  canManage: boolean;
  onChange: (target: PlanTarget) => void;
  checkoutLabel: string;
  primary?: boolean;
}) {
  const className = cn("w-full text-xs font-semibold gap-1.5", primary && "font-bold shadow-sm");
  if (current.tier === tier && (current.interval === interval || !changesInPlace)) {
    return (
      <Button variant="outline" className={className} disabled>
        Plano Atual
      </Button>
    );
  }
  if (!changesInPlace) {
    return (
      <Button asChild variant={primary ? "default" : "secondary"} className={className}>
        <Link href={`/plans/checkout?tier=${tier}&interval=${interval}`}>
          <span>{checkoutLabel}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    );
  }
  const label =
    current.tier === tier
      ? interval === "yearly"
        ? "Mudar para o anual"
        : "Mudar para o mensal"
      : RANK[tier] > RANK[current.tier]
        ? `Mudar para o ${tier === "pro" ? "Profissional" : "Expansão"}`
        : `Voltar para o ${tier === "pro" ? "Profissional" : "Expansão"}`;
  return (
    <Button
      type="button"
      variant={primary ? "default" : "secondary"}
      className={className}
      disabled={!canManage}
      onClick={() => onChange({ tier, interval })}
    >
      <span>{label}</span>
      <ArrowRight className="size-3.5" />
    </Button>
  );
}

export function PlansSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16 animate-pulse">
      {/* Hero Header Skeleton */}
      <div className="text-center space-y-3.5 pt-4">
        <Skeleton className="h-6 w-56 rounded-full mx-auto" />
        <Skeleton className="h-10 w-full max-w-xl mx-auto rounded-lg" />
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-4 w-full max-w-2xl mx-auto rounded" />
          <Skeleton className="h-4 w-3/4 max-w-lg mx-auto rounded" />
        </div>
        {/* Toggle pill */}
        <div className="pt-2 flex justify-center">
          <Skeleton className="h-9 w-60 rounded-full" />
        </div>
      </div>

      {/* 3 Pricing Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {/* Card 1: Grátis */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-4/5 rounded" />
            </div>
            <div className="pt-2 space-y-1">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="pt-3 border-t border-border/50 space-y-2.5">
              <Skeleton className="h-3.5 w-32 rounded mb-3" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full shrink-0" />
                  <Skeleton className={cn("h-3 rounded", i % 2 === 0 ? "w-5/6" : "w-4/5")} />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Card 2: Profissional (Destaque) */}
        <div className="relative flex flex-col justify-between rounded-2xl border-2 border-primary/40 bg-card p-6 pt-7 shadow-md space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
            <div className="pt-2 space-y-1">
              <Skeleton className="h-10 w-36 rounded-md" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
            <div className="pt-3 border-t border-border/50 space-y-2.5">
              <Skeleton className="h-3.5 w-36 rounded mb-3" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full shrink-0" />
                  <Skeleton className={cn("h-3 rounded", i % 2 === 0 ? "w-full" : "w-4/5")} />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Card 3: Expansão */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-32 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-4/5 rounded" />
            </div>
            <div className="pt-2 space-y-1">
              <Skeleton className="h-10 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="pt-3 border-t border-border/50 space-y-2.5">
              <Skeleton className="h-3.5 w-36 rounded mb-3" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full shrink-0" />
                  <Skeleton className={cn("h-3 rounded", i % 2 === 0 ? "w-5/6" : "w-4/5")} />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>

      {/* Garantia e Segurança Banner Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 bg-muted/20 border border-border/60 rounded-xl p-4">
        <Skeleton className="h-4 w-72 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
    </div>
  );
}
