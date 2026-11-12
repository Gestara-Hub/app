"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { plural } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useCan, useCurrentUser, useModel } from "@/features/auth";
import { useWhatsAppConnection, useReminders } from "@/features/communication";
import { useOrganization, useSubscription } from "@/features/settings";
import { useExpiringDocuments } from "@/features/person-documents";
import { useCharges, useDisputedOnlinePayments } from "@/features/turmas";
import { useUserPreferences } from "@/features/preferences";
import { seesPlanNotices } from "@/lib/plan-notice-copy";
import { attentionReminderKeys } from "@/features/communication";
import {
  disputeBellAlerts,
  documentBellAlerts,
  gatewayRejectedBellAlert,
  planBellAlert,
  quotaBellAlert,
  whatsappPendingConnectionBellAlert,
  type BellAlert,
} from "../bell-alerts";
import { newAttentionKeys, seenKeysAfterOpening } from "../bell-pulse";
import { DashboardTodo, useReminderCount } from "./dashboard-todo";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Sino no topo (doc product/25): o numero de pendencias dos lembretes e, ao
 * tocar, a mesma lista do painel num painel lateral. Some sem pendencia. So no
 * modelo de turmas, para quem manda mensagem e para o professor (so os alunos dele).
 * Dono e gerente veem tambem os avisos do espaco (plano, franquia, pagamento online).
 *
 * Niveis (doc product/25, "Níveis, urgência e novos lembretes"): o sino pulsa
 * tres vezes quando ha item de atencao ou urgencia novo desde a ultima abertura.
 */
export function RemindersBell() {
  const can = useCan();
  const model = useModel();
  if (model !== "classes" || !(can("communication:view") || can("clients:view_own"))) return null;
  return <RemindersBellButton />;
}

/** Avisos do espaco (plano, franquia, pagamento online, documentos), conforme quem ve. */
export function useBellAlerts(today: string): BellAlert[] {
  const eligible = seesPlanNotices(useCurrentUser().profile);
  const can = useCan();
  const { data: subscription } = useSubscription();
  const { data: organization } = useOrganization();
  const { data: connection } = useWhatsAppConnection(eligible);
  // Documentos vencendo: quem ve os alunos (ou os dele) ou gerencia a equipe.
  const seesDocuments = can("clients:view") || can("clients:view_own") || can("team:manage");
  const { data: expiring } = useExpiringDocuments(seesDocuments);
  // Estorno e contestacao: quem ve cobrancas (dono e gerente).
  const seesPayments = eligible && can("billing:view");
  const { data: disputed } = useDisputedOnlinePayments(seesPayments);
  const { data: charges } = useCharges(undefined, seesPayments && (disputed ?? []).length > 0);
  const studentNameOf = (chargeId: string) => (charges ?? []).find((c) => c.id === chargeId)?.studentName;
  const planAlerts = eligible
    ? [
        planBellAlert(subscription, today),
        gatewayRejectedBellAlert(organization?.settings?.onlinePayments),
        whatsappPendingConnectionBellAlert(connection),
        quotaBellAlert(connection),
      ].filter((alert): alert is BellAlert => alert !== null)
    : [];
  return [...(seesPayments ? disputeBellAlerts(disputed, studentNameOf) : []), ...planAlerts, ...documentBellAlerts(seesDocuments ? expiring : undefined)];
}

function RemindersBellButton() {
  const today = dateInSpace();
  const alerts = useBellAlerts(today);
  const reminders = useReminders(today);
  const count = useReminderCount(today) + alerts.length;
  const [open, setOpen] = useState(false);
  const { preferences, updatePreferences } = useUserPreferences();

  // Chaves de atencao ou urgencia de agora; novas desde a ultima abertura fazem o sino pulsar.
  const attentionKeys = useMemo(
    () => [...alerts.filter((a) => a.tone !== "info").map((a) => a.key), ...attentionReminderKeys(reminders.groups)],
    [alerts, reminders.groups],
  );
  const fresh = useMemo(() => newAttentionKeys(attentionKeys, preferences.bellSeenKeys), [attentionKeys, preferences.bellSeenKeys]);
  const [pulseId, setPulseId] = useState(0);
  const pulsedFor = useRef<string>("");
  useEffect(() => {
    if (open || fresh.length === 0) return;
    // Pulsa uma vez por conjunto novo (ao entrar e quando chega outro na sessao), nao a cada render.
    const signature = fresh.join("|");
    if (pulsedFor.current === signature) return;
    pulsedFor.current = signature;
    setPulseId((n) => n + 1);
  }, [fresh, open]);

  const queryClient = useQueryClient();
  function openBell() {
    setOpen(true);
    // Gravacoes fora do Painel so marcam os lembretes como velhos: abrir o sino rele.
    void queryClient.refetchQueries({ queryKey: queryKeys.communication.reminders, stale: true });
    // Visto: o que esta no sino agora deixa de ser novo.
    if (fresh.length > 0) updatePreferences({ bellSeenKeys: seenKeysAfterOpening(attentionKeys) });
  }

  if (count === 0 && !open) return null;
  const label = plural(count, "lembrete pendente", "lembretes pendentes");
  return (
    <>
      <Button
        key={pulseId}
        type="button"
        variant="ghost"
        size="icon"
        className={cn("relative", pulseId > 0 && fresh.length > 0 && !open && "bell-pulse")}
        title={label}
        aria-label={`Lembretes: ${label}${fresh.length > 0 ? `, ${plural(fresh.length, "novo", "novos")}` : ""}`}
        onClick={openBell}
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
            <SheetTitle className="text-lg font-semibold text-foreground">Lembretes</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {count > 0 ? plural(count, "pendência", "pendências") : "Tudo em dia."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DashboardTodo today={today} bare alerts={alerts} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
