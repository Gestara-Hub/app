"use client";

import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDate } from "@gestarahub/core/format";
import type { Subscription } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useCan } from "@/features/auth";
import { subscriptionTierLabel } from "@/lib/labels";
import { usePlanChange } from "../hooks/use-plan-change";

/** "Muda para o Grátis em 01/12", com "Desmarcar" (doc product/13 §6). Sem troca marcada, nada. */
export function ScheduledPlanChangeNotice({ subscription }: { subscription: Subscription | undefined }) {
  const can = useCan();
  const { cancelScheduled } = usePlanChange();
  const { confirm, dialog } = useConfirmAction();
  const scheduled = subscription?.scheduledChange;
  if (!subscription || !scheduled) return null;

  const target =
    scheduled.tier === "free"
      ? "o Grátis"
      : `o Plano ${subscriptionTierLabel(scheduled.tier)}${scheduled.interval ? ` ${scheduled.interval === "yearly" ? "anual" : "mensal"}` : ""}`;

  const undo = async () => {
    const ok = await confirm({
      title: "Desmarcar a troca de plano?",
      description: `O Plano ${subscriptionTierLabel(subscription.tier)} continua e renova em ${formatDate(scheduled.effectiveOn)}.`,
      confirmLabel: "Desmarcar",
      variant: "default",
    });
    if (!ok) return;
    cancelScheduled.mutate(undefined, {
      onSuccess: () => toast.success("Troca de plano desmarcada."),
      onError: (error) => toast.error(getErrorMessage(error, "Não foi possível desmarcar a troca.")),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 break-words">
            Muda para {target} em {formatDate(scheduled.effectiveOn)}. Até lá, nada muda.
          </span>
        </p>
        {can("subscription:manage") ? (
          <Button type="button" variant="outline" disabled={cancelScheduled.isPending} onClick={() => void undo()}>
            {cancelScheduled.isPending ? "Salvando..." : "Desmarcar"}
          </Button>
        ) : null}
      </div>
      {dialog}
    </>
  );
}
