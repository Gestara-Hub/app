"use client";

import { Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PaidFeature } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime } from "@gestarahub/core/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { paidFeatureLabel, subscriptionTierLabel } from "@/lib/labels";
import { TIER_FEATURES } from "@/lib/subscription";
import { useCan } from "@/features/auth";
import { useSetSubscriptionTier, useSubscription } from "../hooks/use-subscription";

// O que cada recurso pago entrega (texto curto da aba).
const FEATURE_DESCRIPTION: Record<PaidFeature, string> = {
  online_payments: "Cobrança por Pix, link e Pix Automático com baixa automática no app e web.",
  messaging: "Lembretes de cobrança e avisos automáticos via WhatsApp.",
  reports_advanced: "DRE gerencial, projeção financeira e análise de retenção/churn.",
  bi: "Inteligência analítica preditiva e mapas de ocupação avançados.",
};

const PRO_FEATURES = TIER_FEATURES.pro;

/**
 * Aba "Plano GestaraHub": plano atual, o que o Pro inclui e (so o proprietario,
 * `subscription:manage`) a troca de demonstracao, com confirmacao e auditoria.
 */
export function SubscriptionPlanCard() {
  const can = useCan();
  const canManage = can("subscription:manage");
  const { data, isLoading, isError, refetch } = useSubscription();
  const setTier = useSetSubscriptionTier();
  const { confirm, dialog } = useConfirmAction();

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
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPro = data.tier === "pro";

  const handleChange = async () => {
    const next = isPro ? "free" : "pro";
    const ok = await confirm(
      next === "pro"
        ? {
            title: "Ativar o Plano Pro?",
            description:
              "Demonstração: libera pagamentos online, comunicação automática via WhatsApp e relatórios avançados para esta organização. Nenhuma cobrança é feita.",
            confirmLabel: "Ativar Pro",
            variant: "default",
          }
        : {
            title: "Voltar ao Plano Grátis?",
            description:
              "Os recursos do Pro ficam bloqueados. Os dados já lançados continuam guardados e voltam ao ativar o Pro de novo.",
            confirmLabel: "Voltar ao Grátis",
            variant: "destructive",
          },
    );
    if (!ok) return;
    setTier.mutate(next, {
      onSuccess: () =>
        toast.success(next === "pro" ? "Plano Pro ativado." : "Plano Grátis ativado."),
      onError: (error) =>
        toast.error(getErrorMessage(error, "Não foi possível trocar o plano.")),
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Plano atual</CardTitle>
            <Badge variant={isPro ? "default" : "secondary"}>
              {subscriptionTierLabel(data.tier)}
            </Badge>
          </div>
          <CardDescription>
            {isPro
              ? "Sua organização tem todos os recursos do Pro."
              : "O cadastro e a operação do dia a dia são grátis. Os recursos abaixo fazem parte do Pro."}
            {data.changedAt ? ` Alterado em ${formatDateTime(data.changedAt)}.` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden />O que o Pro inclui
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
                Demonstração: a troca de plano não gera cobrança e fica registrada na Auditoria.
              </p>
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
                    : "Ativar Pro (demonstração)"}
              </Button>
            </div>
          ) : (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              Só o proprietário da conta pode trocar o plano.
            </p>
          )}
        </CardContent>
      </Card>
      {dialog}
    </>
  );
}
