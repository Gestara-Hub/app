"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { History, MessageCircle, MessageSquareText, Plus, Smartphone } from "lucide-react";
import type { CommunicationMetrics, WhatsAppConnectionView } from "@gestarahub/contracts";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import { PageHeader } from "@/components/layout/page-header";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type PageTab, PageTabs } from "@/components/shared/page-tabs";
import { useCommunicationMetrics, useWhatsAppConnection } from "../hooks/use-communication";
import { ConnectionSettingsTab } from "./connection-settings-tab";
import { MessageLogsTab } from "./message-logs-tab";
import { MessageTemplatesTab } from "./message-templates-tab";
import { SendMessageDialog } from "./send-message-dialog";

type Tab = "messages" | "history" | "connection";

const TABS: PageTab<Tab>[] = [
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
  if (connection.officialStatus === "connected" && connection.canUseOfficial) {
    const { used, included } = connection.monthlyQuota;
    const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
    const isExhausted = connection.isQuotaExhausted;

    return (
      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          isExhausted
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-emerald-500/30 bg-emerald-500/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
              isExhausted
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <MessageCircle className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">WhatsApp oficial conectado</p>
              {isExhausted && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Franquia atingida
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isExhausted
                ? "Franquia do ciclo atingida. Suas mensagens continuam disponíveis em 1 toque (envio assistido) até o próximo pagamento da assinatura."
                : `${connection.displayName}${
                    connection.phoneNumber ? ` · ${formatPhone(connection.phoneNumber.replace(/^55/, ""))}` : ""
                  }. As mensagens ligadas saem sozinhas.`}
            </p>
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Franquia do ciclo</span>
            <span className="tabular-nums font-medium text-foreground">
              {used} de {included}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                isExhausted ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${pct}%` }}
            />
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
    <Card className="py-0 shadow-2xs">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.value === value);

export function CommunicationView() {
  // A aba vem do endereco (`?tab=connection`, o link do aviso da franquia no sino).
  // Trocar de aba usa o `history.replaceState` do navegador, que o Next sincroniza
  // com o `useSearchParams` sem ir ao servidor: troca na hora, e dois toques
  // seguidos nao disputam navegacao (com `router.replace`, a tela ficava na aba antiga).
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: Tab = isTab(paramTab) ? paramTab : "messages";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };
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
        <PageTabs tabs={TABS} value={tab} onChange={setTab} label="Seções de comunicação" />

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
