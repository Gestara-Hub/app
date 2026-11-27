"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { todayISO } from "@gestarahub/core/date";
import { planNoticeFor } from "@gestarahub/core/subscription-plan";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { useUserPreferences } from "@/features/preferences";
import { useSubscription } from "@/features/settings";
import { subscriptionTierLabel } from "@/lib/labels";
import { isPinnedPlanNotice, planNoticeCopy, seesPlanNotices } from "@/lib/plan-notice-copy";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import type { BellAlert } from "../bell-alerts";
import { useBellAlerts } from "./reminders-bell";

/**
 * Urgencias (doc product/25, "Níveis, urgência e novos lembretes"): os avisos
 * de nivel `danger` marcados `pinned` ficam fixos no topo ate resolver (abaixo
 * do aviso do plano, que ja tem o proprio banner), e os marcados `modal`
 * abrem uma vez por item, so para dono e gerente, com "Ciente" e "Resolver agora".
 * Lembrete de aluno nunca chega aqui.
 */

const MAX_URGENT_SEEN = 100;

/** Avisos do plano que tambem abrem a modal (plano a cair ou ja no Gratis). */
const PLAN_MODAL_KINDS = new Set(["grace_ending", "reverted"]);

function usePlanModalAlert(today: string): BellAlert | null {
  const user = useCurrentUser();
  const { data: subscription } = useSubscription();
  if (!seesPlanNotices(user.profile) || !subscription) return null;
  const notice = planNoticeFor(subscription, today);
  if (!notice || !isPinnedPlanNotice(notice) || !PLAN_MODAL_KINDS.has(notice.kind)) return null;
  const tier = subscription.revertedFrom?.tier ?? subscription.tier;
  const copy = planNoticeCopy(notice, subscriptionTierLabel(tier));
  return {
    key: `plan-modal:${notice.kind}:${notice.renewsOn}`,
    kind: "plan",
    title: copy.title,
    text: copy.text,
    tone: "danger",
    href: "/settings?tab=plano",
    action: copy.action,
    modal: true,
  };
}

export function UrgentNoticesHost() {
  const isClient = useIsClient();
  const today = todayISO();
  const user = useCurrentUser();
  const alerts = useBellAlerts(today);
  const planModal = usePlanModalAlert(today);
  const { preferences, updatePreferences } = useUserPreferences();
  const router = useRouter();
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);

  const pathname = usePathname();
  // Na tela que ja mostra o problema com a acao, o aviso fixo nao se repete.
  const pinned = alerts.filter((a) => a.pinned && a.tone === "danger" && a.hidePinnedOn !== pathname);
  const seen = useMemo(() => new Set([...(preferences.urgentSeenKeys ?? []), ...dismissedNow]), [preferences.urgentSeenKeys, dismissedNow]);
  // Modal: so dono e gerente, uma vez por item e por pessoa; o aviso fixo continua ate resolver.
  const eligible = seesPlanNotices(user.profile);
  const modal = eligible ? [...(planModal ? [planModal] : []), ...alerts.filter((a) => a.modal)].find((a) => !seen.has(a.key)) : undefined;

  function acknowledge(alert: BellAlert) {
    setDismissedNow((keys) => [...keys, alert.key]);
    const next = [...(preferences.urgentSeenKeys ?? []).filter((k) => k !== alert.key), alert.key].slice(-MAX_URGENT_SEEN);
    updatePreferences({ urgentSeenKeys: next });
  }

  if (!isClient) return null;
  return (
    <>
      {pinned.map((alert) => (
        <div
          key={alert.key}
          role="status"
          className={cn("mx-4 mt-3 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between md:mx-6")}
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0">
              <p className="min-w-0 break-words text-sm font-semibold">{alert.title}</p>
              <p className="min-w-0 break-words text-xs text-muted-foreground">{alert.text}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href={alert.href}>{alert.action}</Link>
          </Button>
        </div>
      ))}

      <AlertDialog open={Boolean(modal)} onOpenChange={(open) => (!open && modal ? acknowledge(modal) : undefined)}>
        {modal ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <ShieldAlert className="size-5" aria-hidden />
              </div>
              <AlertDialogTitle>{modal.title}</AlertDialogTitle>
              <AlertDialogDescription>{modal.text}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => acknowledge(modal)}>Ciente</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  acknowledge(modal);
                  router.push(modal.href);
                }}
              >
                Resolver agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </>
  );
}
