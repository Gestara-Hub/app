"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { todayISO } from "@gestarahub/core/date";
import { planNoticeFor } from "@gestarahub/core/subscription-plan";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { useSubscription } from "@/features/settings";
import { subscriptionTierLabel } from "@/lib/labels";
import { planNoticeCopy } from "@/lib/plan-notice-copy";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";

const TONE = {
  info: "border-sky-500/30 bg-sky-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  danger: "border-destructive/30 bg-destructive/10",
} as const;

/**
 * Aviso fixo da renovacao do plano no topo do app, para dono e gerente (doc
 * product/13 §6): renova em 3 dias (Pix), pagamento pendente, faltam 2 dias,
 * de volta ao Gratis (15 dias para pagar antes de encerrar a assinatura) e
 * assinatura encerrada. Os mesmos textos do e-mail (`lib/plan-notice-copy`).
 */
export function PlanNoticeBanner() {
  const user = useCurrentUser();
  const eligible = user.profile === "owner" || user.profile === "manager";
  const { data: subscription } = useSubscription();
  // O dia sai do fuso do espaco no navegador: so depois de montar.
  const isClient = useIsClient();
  if (!eligible || !isClient) return null;
  const notice = planNoticeFor(subscription, todayISO());
  if (!notice || !subscription) return null;

  const tier = subscription.revertedFrom?.tier ?? subscription.closedFrom?.tier ?? subscription.tier;
  const copy = planNoticeCopy(notice, subscriptionTierLabel(tier));
  const invoiceUrl = subscription.pendingPayment?.invoiceUrl;
  const Icon = notice.kind === "renews_soon" ? CalendarClock : AlertTriangle;

  return (
    <div role="status" className={cn("mx-4 mt-3 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between md:mx-6", TONE[copy.tone])}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">{copy.title}</p>
          <p className="text-xs text-muted-foreground break-words">{copy.text}</p>
        </div>
      </div>
      {notice.kind === "closed" ? (
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/plans">{copy.action}</Link>
        </Button>
      ) : invoiceUrl ? (
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
