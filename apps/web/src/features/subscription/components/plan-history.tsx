"use client";

import { History } from "lucide-react";
import type { SubscriptionEventKind, SubscriptionTier } from "@gestarahub/contracts";
import { formatCents, formatDateTime } from "@gestarahub/core/format";
import { Skeleton } from "@/components/ui/skeleton";
import { subscriptionTierLabel } from "@/lib/labels";
import { usePlanHistory } from "../hooks/use-plan-change";

const KIND_LABEL: Record<SubscriptionEventKind, string> = {
  activated: "Assinou",
  upgraded: "Mudou de plano",
  change_scheduled: "Troca marcada",
  change_canceled: "Troca desmarcada",
  change_applied: "Troca aplicada",
  renewed: "Renovou",
  renewal_overdue: "Renovação vencida",
  reverted_to_free: "Voltou ao Grátis",
  reactivated: "Religou o plano",
  closed: "Assinatura encerrada",
  canceled: "Voltou ao Grátis",
  removed_at_partner: "Removida no parceiro",
  courtesy_granted: "Cortesia concedida",
  courtesy_ended: "Cortesia terminou",
  courtesy_revoked: "Cortesia encerrada",
  grace_extended: "Mais dias para pagar",
  forced_free: "Voltou ao Grátis",
};

function plan(tier: SubscriptionTier | undefined, interval: string | undefined): string {
  if (!tier || tier === "free") return "Grátis";
  return `${subscriptionTierLabel(tier)} ${interval === "yearly" ? "anual" : "mensal"}`;
}

/**
 * Historico do Plano GestaraHub (doc technical/23): quando assinou, trocou,
 * renovou, voltou ao Gratis e por que, com quem fez (pessoa ou automatico).
 * As mesmas frases ficam na Auditoria.
 */
export function PlanHistory() {
  const { data, isPending, isError } = usePlanHistory();
  if (isError) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <History className="size-4 text-muted-foreground" aria-hidden />
        Histórico do plano
      </p>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada registrado ainda.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((event) => {
            const before = plan(event.tierBefore, event.intervalBefore);
            const after = plan(event.tierAfter, event.intervalAfter);
            return (
              <li key={event.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">
                    {KIND_LABEL[event.kind]}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {before !== after && event.tierBefore !== undefined ? `${before} → ${after}` : after}
                      {event.amountCents ? ` · ${formatCents(event.amountCents)}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    {event.actorName}
                    {event.system ? " · Automático" : ""}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(event.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
