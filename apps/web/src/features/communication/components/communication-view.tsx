"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  Eye,
  History,
  MessageCircle,
  MessageSquareText,
  Plus,
  Send,
  Smartphone,
  Wallet,
} from "lucide-react";
import type {
  CommunicationMetrics,
  MessageLogKind,
  MessageLogStatus,
  WhatsAppConnectionView,
} from "@gestarahub/contracts";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import { PageHeader } from "@/components/layout/page-header";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type PageTab, PageTabs } from "@/components/shared/page-tabs";
import { useCan } from "@/features/auth";
import { cn } from "@/lib/utils";
import {
  useCommunicationMetrics,
  useMessageComposerContext,
  useWhatsAppConnection,
} from "../hooks/use-communication";
import { ConnectionSettingsTab } from "./connection-settings-tab";
import { MessageLogsTab } from "./message-logs-tab";
import { MessageTemplatesTab } from "./message-templates-tab";
import { SendMessageDialog } from "./send-message-dialog";

type Tab = "messages" | "history" | "connection";
type LogPeriod = "all" | "today" | "7d" | "month";
interface HistoryPreset {
  status?: "all" | MessageLogStatus;
  kind?: MessageLogKind;
  period?: LogPeriod;
}

/** Como as mensagens saem hoje: assistido (gratis) ou WhatsApp oficial (Pro). */
function ModeBanner({
  connection,
  canManage,
  canManagePlan,
  isCurrentTabConnection,
  onConnect,
}: {
  connection: WhatsAppConnectionView;
  canManage: boolean;
  canManagePlan: boolean;
  isCurrentTabConnection?: boolean;
  onConnect: () => void;
}) {
  if (connection.officialStatus === "connected" && connection.canUseOfficial) {
    // Bloqueio na Meta (doc technical/07 §1.6): a faixa avisa e leva a Conexao.
    const health = connection.metaHealth;
    if (health?.sendState === "blocked" || health?.paymentBlocked) {
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Mensagens automáticas bloqueadas pela Meta</p>
              <p className="break-words text-xs text-muted-foreground">
                {health.paymentBlocked
                  ? "Falta uma forma de pagamento válida na sua conta do WhatsApp na Meta."
                  : "A Meta não está deixando as mensagens automáticas saírem."}
              </p>
            </div>
          </div>
          {!isCurrentTabConnection ? (
            <Button type="button" variant="outline" onClick={onConnect}>
              Ver na Conexão
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <MessageCircle className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">WhatsApp oficial conectado</p>
          <p className="break-words text-xs text-muted-foreground">
            {`${connection.displayName}${
              connection.phoneNumber ? ` · ${formatPhone(connection.phoneNumber.replace(/^55/, ""))}` : ""
            }. As mensagens ligadas saem sozinhas e a Meta cobra cada uma na sua conta.`}
          </p>
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
      {canManage && !isCurrentTabConnection ? (
        connection.canUseOfficial ? (
          <Button type="button" variant="outline" className="shrink-0" onClick={onConnect}>
            Conectar WhatsApp oficial
          </Button>
        ) : canManagePlan ? (
          <Button type="button" variant="outline" className="shrink-0" asChild>
            <Link href={PLAN_SETTINGS_HREF}>Envio automático no Pro</Link>
          </Button>
        ) : null
      ) : null}
    </div>
  );
}

type SummaryTone = "neutral" | "success" | "warning";

const SUMMARY_ICON_TONE: Record<SummaryTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const SUMMARY_VALUE_TONE: Record<SummaryTone, string> = {
  neutral: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
};

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  action,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: SummaryTone;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="py-0 shadow-2xs">
      {/* Rotulo e valor seguem irmaos diretos no mesmo CardContent (invariante dos testes de resumo). */}
      <CardContent className="grid h-full grid-cols-[1fr_auto] items-start gap-x-2 p-4">
        <p className="min-w-0 text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "row-span-2 flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
            SUMMARY_ICON_TONE[tone],
          )}
        >
          {icon}
        </div>
        <p className={cn("col-start-1 mt-1 text-xl font-bold tabular-nums sm:text-2xl", SUMMARY_VALUE_TONE[tone])}>
          {value}
        </p>
        <p className="col-span-2 mt-0.5 text-xs text-muted-foreground">{hint}</p>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="col-span-2 mt-auto inline-flex cursor-pointer items-center gap-1 pt-2.5 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {action.label}
            <ChevronRight className="size-3" />
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Ate 4 numeros do mes; no assistido nao ha entrega nem leitura para medir. */
function SummaryCards({
  metrics,
  canViewFinance,
  onOpenHistory,
}: {
  metrics: CommunicationMetrics;
  canViewFinance: boolean;
  onOpenHistory: (preset: HistoryPreset) => void;
}) {
  const rate = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR")}%`);
  if (metrics.mode === "assisted") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <SummaryCard
          label="Abertas no WhatsApp"
          value={String(metrics.messagesThisMonth)}
          hint="Mensagens prontas abertas neste mês"
          icon={<MessageCircle />}
          action={{ label: "Ver histórico do mês", onClick: () => onOpenHistory({ period: "month" }) }}
        />
        {canViewFinance ? (
          <SummaryCard
            label="Recebido depois de lembrete"
            value={formatCents(metrics.recoveredAmountCents)}
            hint="Cobranças pagas neste mês depois de um lembrete"
            icon={<Wallet />}
            tone={metrics.recoveredAmountCents > 0 ? "success" : "neutral"}
            action={{ label: "Ver cobranças enviadas", onClick: () => onOpenHistory({ kind: "billing", period: "month" }) }}
          />
        ) : null}
      </div>
    );
  }

  const sentCount = metrics.sentCount ?? metrics.messagesThisMonth;
  const deliveredCount = metrics.deliveredCount;
  const readCount = metrics.readCount;
  const failedCount = metrics.failedCount ?? 0;
  const inProgressCount = metrics.inProgressCount ?? 0;

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        canViewFinance ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3",
      )}
    >
      <SummaryCard
        label="Enviadas no mês"
        value={String(metrics.messagesThisMonth)}
        hint={
          failedCount > 0 ? `Automáticas neste mês · ${failedCount} com falha` : "Automáticas neste mês"
        }
        icon={<Send />}
        tone={failedCount > 0 ? "warning" : "neutral"}
        action={
          failedCount > 0
            ? { label: `Ver ${failedCount} com falha`, onClick: () => onOpenHistory({ status: "failed", period: "month" }) }
            : { label: "Ver histórico do mês", onClick: () => onOpenHistory({ period: "month" }) }
        }
      />
      <SummaryCard
        label="Entregues"
        value={rate(metrics.deliveryRate)}
        hint={
          sentCount > 0 && deliveredCount !== undefined
            ? `${deliveredCount} de ${sentCount}${inProgressCount > 0 ? ` · ${inProgressCount} a caminho` : ""}`
            : "Sem envios neste mês"
        }
        icon={<CheckCheck />}
        tone={
          sentCount === 0
            ? "neutral"
            : failedCount > 0 && (metrics.deliveryRate ?? 100) < 85
              ? "warning"
              : "success"
        }
        action={
          failedCount > 0
            ? { label: "Ver falhas", onClick: () => onOpenHistory({ status: "failed", period: "month" }) }
            : { label: "Ver entregues", onClick: () => onOpenHistory({ status: "delivered", period: "month" }) }
        }
      />
      <SummaryCard
        label="Lidas"
        value={rate(metrics.readRate)}
        hint={
          sentCount > 0 && readCount !== undefined
            ? `${readCount} de ${sentCount} enviadas`
            : "Sem envios neste mês"
        }
        icon={<Eye />}
        tone={readCount && readCount > 0 ? "success" : "neutral"}
        action={{ label: "Ver lidas", onClick: () => onOpenHistory({ status: "read", period: "month" }) }}
      />
      {canViewFinance ? (
        <SummaryCard
          label="Recebido depois de lembrete"
          value={formatCents(metrics.recoveredAmountCents)}
          hint="Cobranças pagas no mês depois de um lembrete"
          icon={<Wallet />}
          tone={metrics.recoveredAmountCents > 0 ? "success" : "neutral"}
          action={{ label: "Ver cobranças enviadas", onClick: () => onOpenHistory({ kind: "billing", period: "month" }) }}
        />
      ) : null}
    </div>
  );
}

export function CommunicationView() {
  const can = useCan();
  const canManage = can("communication:manage");
  const canManagePlan = can("subscription:manage");
  const canViewFinance = can("finance:view");
  const canViewClients = can("clients:view") || can("clients:view_own");

  const availableTabs: PageTab<Tab>[] = [
    { value: "messages", label: "Mensagens", icon: MessageSquareText },
    { value: "history", label: "Histórico", icon: History },
    ...(canManage ? [{ value: "connection" as const, label: "Conexão", icon: Smartphone }] : []),
  ];

  // A aba vem do endereco (`?tab=connection`, o link do aviso do WhatsApp no sino).
  // Trocar de aba usa o `history.replaceState` do navegador, que o Next sincroniza
  // com o `useSearchParams` sem ir ao servidor: troca na hora, e dois toques
  // seguidos nao disputam navegacao (com `router.replace`, a tela ficava na aba antiga).
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const isAllowedTab = (value: string | null): value is Tab =>
    availableTabs.some((t) => t.value === value);
  const tab: Tab = isAllowedTab(paramTab) ? paramTab : "messages";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };
  const [sendOpen, setSendOpen] = useState(false);
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset & { key: number }>({ key: 0 });
  const { data: connection } = useWhatsAppConnection();
  const { data: metrics, isPending: metricsPending } = useCommunicationMetrics();
  const official = connection?.mode === "official";
  const { data: composerContext } = useMessageComposerContext(official);

  const openHistory = (preset: HistoryPreset) => {
    setHistoryPreset((prev) => ({ key: prev.key + 1, ...preset }));
    setTab("history");
  };

  const withoutConsent = composerContext
    ? composerContext.missingConsentCount + composerContext.revokedConsentCount
    : 0;

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
        <ModeBanner
          connection={connection}
          canManage={canManage}
          canManagePlan={canManagePlan}
          isCurrentTabConnection={tab === "connection"}
          onConnect={() => setTab("connection")}
        />
      ) : (
        <Skeleton className="h-20 w-full rounded-xl" />
      )}

      {official && composerContext && withoutConsent > 0 && composerContext.activeStudentsCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">
                {withoutConsent === 1
                  ? "1 aluno ativo ainda sem autorização para envio automático no WhatsApp"
                  : `${withoutConsent} alunos ativos ainda sem autorização para envio automático no WhatsApp`}
              </p>
              <p className="text-muted-foreground">
                {composerContext.consentedCount} de {composerContext.activeStudentsCount} autorizados. Sem autorização no cadastro, os avisos automáticos não são disparados.
              </p>
            </div>
          </div>
          {canViewClients ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0 self-start sm:self-center" asChild>
              <Link href="/clients">Revisar em Alunos</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {metricsPending || !metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <SummaryCards metrics={metrics} canViewFinance={canViewFinance} onOpenHistory={openHistory} />
      )}

      <div className="space-y-4">
        <PageTabs tabs={availableTabs} value={tab} onChange={setTab} label="Seções de comunicação" />

        <div role="tabpanel">
          {tab === "messages" ? <MessageTemplatesTab /> : null}
          {tab === "history" ? (
            <MessageLogsTab
              key={historyPreset.key}
              initialStatus={historyPreset.status}
              initialKind={historyPreset.kind}
              initialPeriod={historyPreset.period}
            />
          ) : null}
          {tab === "connection" && canManage ? <ConnectionSettingsTab /> : null}
        </div>
      </div>

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} />
    </div>
  );
}
