"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { plural } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCan, useCurrentUser, useModel } from "@/features/auth";
import { useWhatsAppConnection } from "@/features/communication";
import { useSubscription } from "@/features/settings";
import { useExpiringDocuments } from "@/features/person-documents";
import { seesPlanNotices } from "@/lib/plan-notice-copy";
import {
  planBellAlert,
  quotaBellAlert,
  whatsappPendingConnectionBellAlert,
  documentBellAlerts,
  type BellAlert,
} from "../bell-alerts";
import { DashboardTodo, useReminderCount } from "./dashboard-todo";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Sino no topo (doc product/25): o numero de pendencias dos lembretes e, ao
 * tocar, a mesma lista do painel num painel lateral. Some sem pendencia. So no
 * modelo de turmas, para quem manda mensagem e para o professor (so os alunos dele).
 * Dono e gerente veem tambem os avisos do plano e da franquia de mensagens.
 */
export function RemindersBell() {
  const can = useCan();
  const model = useModel();
  if (model !== "classes" || !(can("communication:view") || can("clients:view_own"))) return null;
  return <RemindersBellButton />;
}

/** Avisos do plano e da franquia, so para quem ve os avisos do plano. */
export function useBellAlerts(today: string): BellAlert[] {
  const eligible = seesPlanNotices(useCurrentUser().profile);
  const can = useCan();
  const { data: subscription } = useSubscription();
  const { data: connection } = useWhatsAppConnection(eligible);
  // Documentos vencendo: quem ve os alunos (ou os dele) ou gerencia a equipe.
  const seesDocuments = can("clients:view") || can("clients:view_own") || can("team:manage");
  const { data: expiring } = useExpiringDocuments(seesDocuments);
  const planAlerts = eligible
    ? [
        planBellAlert(subscription, today),
        whatsappPendingConnectionBellAlert(connection),
        quotaBellAlert(connection),
      ].filter((alert): alert is BellAlert => alert !== null)
    : [];
  return [...planAlerts, ...documentBellAlerts(seesDocuments ? expiring : undefined)];
}

function RemindersBellButton() {
  const today = dateInSpace();
  const alerts = useBellAlerts(today);
  const count = useReminderCount(today) + alerts.length;
  const [open, setOpen] = useState(false);
  if (count === 0 && !open) return null;
  const label = plural(count, "lembrete pendente", "lembretes pendentes");
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        title={label}
        aria-label={`Lembretes: ${label}`}
        onClick={() => setOpen(true)}
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
