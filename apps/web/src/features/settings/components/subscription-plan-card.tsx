"use client";

import Link from "next/link";
import { ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PaidFeature } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime } from "@gestarahub/core/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { isDemoSpace } from "@/lib/demo";
import { paidFeatureLabel, subscriptionTierLabel } from "@/lib/labels";
import { proOnlyFeatures } from "@/lib/subscription";
import { useCan, useCurrentUser } from "@/features/auth";
import { PlanChangeDialog, PlanHistory, ScheduledPlanChangeNotice } from "@/features/subscription";
import { useState } from "react";
import { formatDate } from "@gestarahub/core/format";
import { useSetSubscriptionTier, useSubscription } from "../hooks/use-subscription";

// O que cada recurso pago entrega (texto curto da aba).
const FEATURE_DESCRIPTION: Record<PaidFeature, string> = {
  online_payments: "Cobrança por Pix, link e Pix Automático com baixa automática no app e web.",
  messaging: "Lembretes de cobrança e avisos automáticos via WhatsApp.",
  reports_advanced: "Resultado do mês e retenção dos alunos.",
  certificates: "Certificado de conclusão do curso para imprimir ou salvar em PDF.",
  bi: "Inteligência analítica preditiva e mapas de ocupação avançados.",
};

// So o que o Grátis não tem: o pagamento online já é do Grátis (achado 67).
const PRO_FEATURES = proOnlyFeatures();

/**
 * Aba "Plano GestaraHub": plano atual, o que o Pro inclui e (so o proprietario,
 * `subscription:manage`) a troca do plano, com confirmacao e auditoria. Ativar
 * o Profissional sem pagar so no espaco de demonstracao; a conta real assina
 * pelo checkout (achado 66 do teste de 23/10).
 */
export function SubscriptionPlanCard() {
  const can = useCan();
  const canManage = can("subscription:manage");
  const demo = isDemoSpace(useCurrentUser().organizationId);
  const { data, isLoading, isError, refetch } = useSubscription();
  const setTier = useSetSubscriptionTier();
  const { confirm, dialog } = useConfirmAction();
  const [leaving, setLeaving] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o plano.</p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Scale inclui tudo do Pro (e a multiunidade): nao e Gratis.
  const isPro = data.tier !== "free";
  const isScale = data.tier === "scale";

  const handleChange = async () => {
    // Conta real com plano pago: o Gratis vale no fim do periodo pago (doc product/13 §6).
    if (isPro && !demo) {
      setLeaving(true);
      return;
    }
    const next = isPro ? "free" : "pro";
    const ok = await confirm(
      next === "pro"
        ? {
            title: "Ativar o Plano Profissional?",
            description:
              "Demonstração: libera pagamentos online, comunicação automática via WhatsApp e relatórios avançados para esta organização. Nenhuma cobrança é feita.",
            confirmLabel: "Ativar Profissional",
            variant: "default",
          }
        : {
            title: "Voltar ao Plano Grátis?",
            description:
              "Os recursos do Profissional ficam bloqueados. Os dados já lançados continuam guardados e voltam ao ativar o Profissional de novo.",
            confirmLabel: "Voltar ao Grátis",
            variant: "destructive",
          },
    );
    if (!ok) return;
    setTier.mutate(next, {
      onSuccess: () =>
        toast.success(next === "pro" ? "Plano Profissional ativado." : "Plano Grátis ativado."),
      onError: (error) =>
        toast.error(getErrorMessage(error, "Não foi possível trocar o plano.")),
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Plano atual</CardTitle>
              <Badge variant={isPro ? "default" : "secondary"}>
                {subscriptionTierLabel(data.tier)}
              </Badge>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Link href="/plans">
                <Sparkles className="size-3.5 text-primary" />
                <span>Comparar todos os planos</span>
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          <CardDescription>
            {isScale
              ? "Sua organização tem todos os recursos do Profissional e várias unidades."
              : isPro
              ? "Sua organização tem todos os recursos do Profissional."
              : "O cadastro e a operação do dia a dia são grátis. Os recursos abaixo fazem parte do Profissional."}
            {data.changedAt ? ` Alterado em ${formatDateTime(data.changedAt)}.` : null}
            {isPro && data.renewsOn && !data.scheduledChange ? ` Renova em ${formatDate(data.renewsOn)}.` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ScheduledPlanChangeNotice subscription={data} />
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden />O que o Profissional inclui
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 rounded-lg border p-3">
                  {isPro ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{paidFeatureLabel(feature)}</p>
                    <p className="text-xs text-muted-foreground">{FEATURE_DESCRIPTION[feature]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {canManage ? (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {demo
                  ? "Demonstração: a troca de plano não gera cobrança e fica registrada na Auditoria."
                  : isPro
                    ? "Voltar ao Grátis vale no fim do período pago. Os dados ficam guardados."
                    : "Escolha o período e pague por Pix ou cartão."}
              </p>
              {data.scheduledChange ? null : demo || isPro ? (
                <Button
                  type="button"
                  variant={isPro ? "outline" : "default"}
                  disabled={setTier.isPending}
                  onClick={() => void handleChange()}
                >
                  {setTier.isPending
                    ? "Salvando..."
                    : isPro
                      ? "Voltar ao Grátis"
                      : "Ativar Profissional (demonstração)"}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/plans/checkout?tier=pro&interval=monthly">Assinar o Profissional</Link>
                </Button>
              )}
            </div>
          ) : (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              Só o proprietário da conta pode trocar o plano.
            </p>
          )}
          {canManage ? <PlanHistory /> : null}
        </CardContent>
      </Card>
      {dialog}
      <PlanChangeDialog
        target={leaving ? { tier: "free", interval: data.interval ?? "monthly" } : null}
        onOpenChange={(open) => setLeaving(open)}
      />
    </>
  );
}
