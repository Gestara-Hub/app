"use client";

import { useState } from "react";
import Link from "next/link";
import { History, MessageCircle, MessageSquareText, Plus, Smartphone } from "lucide-react";
import type { CommunicationMetrics, WhatsAppConnectionView } from "@gestarahub/contracts";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import { PageHeader } from "@/components/layout/page-header";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCommunicationMetrics, useWhatsAppConnection } from "../hooks/use-communication";
import { ConnectionSettingsTab } from "./connection-settings-tab";
import { MessageLogsTab } from "./message-logs-tab";
import { MessageTemplatesTab } from "./message-templates-tab";
import { SendMessageDialog } from "./send-message-dialog";

type Tab = "messages" | "history" | "connection";

const TABS: { value: Tab; label: string; icon: typeof History }[] = [
  { value: "messages", label: "Mensagens", icon: MessageSquareText },
  { value: "history", label: "Histórico", icon: History },
  { value: "connection", label: "Conexão", icon: Smartphone },
];

/** Como as mensagens saem hoje: assistido (gratis) ou WhatsApp oficial (Pro). */
function ModeBanner({
  connection,
  onConnect,
}: {
  connection: WhatsAppConnectionView;
  onConnect: () => void;
}) {
  if (connection.mode === "official") {
    const { used, included } = connection.monthlyQuota;
    const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <MessageCircle className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">WhatsApp oficial conectado</p>
            <p className="text-xs text-muted-foreground">
              {connection.displayName}
              {connection.phoneNumber ? ` · ${formatPhone(connection.phoneNumber.replace(/^55/, ""))}` : ""}. As
              mensagens ligadas saem sozinhas.
            </p>
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Franquia do mês</span>
            <span className="tabular-nums">
              {used} de {included}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Envio assistido</p>
          <p className="text-xs text-muted-foreground">
            O botão abre o WhatsApp deste aparelho com a mensagem pronta. Você só toca em enviar.
          </p>
        </div>
      </div>
      {connection.canUseOfficial ? (
        <Button type="button" variant="outline" className="shrink-0" onClick={onConnect}>
          Conectar WhatsApp oficial
        </Button>
      ) : (
        <Button type="button" variant="outline" className="shrink-0" asChild>
          <Link href={PLAN_SETTINGS_HREF}>Envio automático no Pro</Link>
        </Button>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="shadow-2xs">
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Ate 4 numeros do mes; no assistido nao ha entrega nem leitura para medir. */
function SummaryCards({ metrics }: { metrics: CommunicationMetrics }) {
  const rate = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR")}%`);
  if (metrics.mode === "assisted") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Abertas no WhatsApp"
          value={String(metrics.messagesThisMonth)}
          hint="Mensagens prontas abertas neste mês"
        />
        <SummaryCard
          label="Recebido depois de lembrete"
          value={formatCents(metrics.recoveredAmountCents)}
          hint="Cobranças pagas neste mês depois de um lembrete"
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <SummaryCard
        label="Enviadas no mês"
        value={String(metrics.messagesThisMonth)}
        hint={`De ${metrics.monthlyQuota} da franquia`}
      />
      <SummaryCard label="Entregues" value={rate(metrics.deliveryRate)} hint="Das enviadas no mês" />
      <SummaryCard label="Lidas" value={rate(metrics.readRate)} hint="Das enviadas no mês" />
      <SummaryCard
        label="Recebido depois de lembrete"
        value={formatCents(metrics.recoveredAmountCents)}
        hint="Cobranças pagas no mês depois de um lembrete"
      />
    </div>
  );
}

export function CommunicationView() {
  const [tab, setTab] = useState<Tab>("messages");
  const [sendOpen, setSendOpen] = useState(false);
  const { data: connection } = useWhatsAppConnection();
  const { data: metrics, isPending: metricsPending } = useCommunicationMetrics();
  const official = connection?.mode === "official";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunicação"
        description={
          official
            ? "Mensagens automáticas pelo WhatsApp oficial do seu espaço."
            : "Mensagens prontas que abrem no WhatsApp do seu espaço."
        }
      >
        <Button type="button" onClick={() => setSendOpen(true)}>
          <Plus className="size-4" />
          Nova mensagem
        </Button>
      </PageHeader>

      {connection ? (
        <ModeBanner connection={connection} onConnect={() => setTab("connection")} />
      ) : (
        <Skeleton className="h-20 w-full rounded-xl" />
      )}

      {metricsPending || !metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <SummaryCards metrics={metrics} />
      )}

      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="Seções de comunicação"
          className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "messages" ? <MessageTemplatesTab /> : null}
          {tab === "history" ? <MessageLogsTab /> : null}
          {tab === "connection" ? <ConnectionSettingsTab /> : null}
        </div>
      </div>

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} />
    </div>
  );
}
