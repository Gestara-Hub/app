"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { todayISO } from "@gestarahub/core/date";
import { planNoticeFor } from "@gestarahub/core/subscription-plan";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { useSubscription } from "@/features/settings";
import { subscriptionTierLabel } from "@/lib/labels";
import { isPinnedPlanNotice, planNoticeCopy, seesPlanNotices } from "@/lib/plan-notice-copy";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";

const TONE = {
  info: "border-sky-500/30 bg-sky-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  danger: "border-destructive/30 bg-destructive/10",
} as const;

/**
 * Aviso fixo da renovacao do plano no topo do app, para dono e gerente (doc
 * product/13 §6), so quando o plano esta para cair ou ja caiu: faltam 2 dias e
 * de volta ao Gratis (15 dias para pagar antes de encerrar a assinatura). Renova
 * em 3 dias, pagamento pendente e assinatura encerrada ficam no sino. Os mesmos
 * textos do e-mail (`lib/plan-notice-copy`).
 */
export function PlanNoticeBanner() {
  const user = useCurrentUser();
  const eligible = seesPlanNotices(user.profile);
  const { data: subscription } = useSubscription();
  // O dia sai do fuso do espaco no navegador: so depois de montar.
  const isClient = useIsClient();
  if (!eligible || !isClient) return null;
  const notice = planNoticeFor(subscription, todayISO());
  if (!notice || !subscription || !isPinnedPlanNotice(notice)) return null;

  const tier = subscription.revertedFrom?.tier ?? subscription.tier;
  const copy = planNoticeCopy(notice, subscriptionTierLabel(tier));
  const invoiceUrl = subscription.pendingPayment?.invoiceUrl;

  return (
    <div role="status" className={cn("mx-4 mt-3 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between md:mx-6", TONE[copy.tone])}>
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">{copy.title}</p>
          <p className="text-xs text-muted-foreground break-words">{copy.text}</p>
        </div>
      </div>
      {invoiceUrl ? (
        <Button asChild className="shrink-0">
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
            {copy.action}
          </a>
        </Button>
      ) : (
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/settings?tab=plano">Ver o plano</Link>
        </Button>
      )}
    </div>
  );
}
