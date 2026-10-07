"use client";

import { useState } from "react";
import { formatCents } from "@gestarahub/core/format";
import {
  BellRing,
  CheckCheck,
  Eye,
  History,
  MessageSquareText,
  Send,
  Smartphone,
  TrendingUp,
  Zap,
} from "lucide-react";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHasFeature } from "@/features/auth";
import { cn } from "@/lib/utils";
import {
  useCommunicationMetrics,
  useWhatsAppSession,
} from "../hooks/use-communication";
import { AutomationRulesTab } from "./automation-rules-tab";
import { ConnectionSettingsTab } from "./connection-settings-tab";
import { MessageLogsTab } from "./message-logs-tab";
import { SendMessageDialog } from "./send-message-dialog";

export function CommunicationView() {
  const hasFeature = useHasFeature();
  const hasMessaging = hasFeature("messaging");

  const [activeTab, setActiveTab] = useState("reguas");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const { data: session } = useWhatsAppSession();
  const { data: metrics } = useCommunicationMetrics();

  if (!hasMessaging) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Comunicação
          </h1>
          <p className="text-sm text-muted-foreground">
            Gateway WhatsApp oficial, régua de cobrança e automações de relacionamento.
          </p>
        </div>

        <FeatureLocked
          title="Comunicação & WhatsApp Automatizado"
          description="Coloque a comunicação do seu negócio no piloto automático. Reduza a inadimplência com lembretes automáticos de cobrança via WhatsApp com Pix Copia e Cola, envie boas-vindas e recupere alunos que pararam de frequentar."
          benefits={[
            "Gateway WhatsApp integrado ao número comercial do seu negócio",
            "Régua de cobrança inteligente: lembrete 3 dias antes, no vencimento e pós-atraso",
            "Envio automático de chave Pix Copia e Cola e link seguro de pagamento",
            "Boas-vindas automáticas na matrícula com link de acesso ao app do aluno",
            "Disparo anti-evasão: 'Sentimos sua falta' para alunos sem frequência há 14 dias",
            "Franquia de 1.000 disparos mensais incluídos sem custo adicional de API Meta",
          ]}
        />
      </div>
    );
  }

  const isConnected = session?.status === "connected";
  const quotaUsed = metrics?.sentThisMonth ?? 342;
  const quotaTotal = metrics?.monthlyQuota ?? 1000;
  const quotaPercent = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Comunicação
            </h1>
            {isConnected ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 gap-1 text-xs py-0.5"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                WhatsApp Conectado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 gap-1 text-xs py-0.5"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                WhatsApp Desconectado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gateway WhatsApp oficial, réguas de cobrança automatizadas e histórico de envios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setSendDialogOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Send className="size-3.5" />
            Disparo Avulso
          </Button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Disparos no Mês */}
        <Card className="shadow-2xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Franquia do Mês</span>
              <MessageSquareText className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">
                {quotaUsed}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {quotaTotal}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {quotaPercent}% da franquia Pro utilizada
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card className="shadow-2xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Taxa de Entrega</span>
              <CheckCheck className="size-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">
                {metrics?.deliveryRate ?? 99.4}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <span className="text-emerald-600 font-medium">99.4%</span> entregues no WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Leitura */}
        <Card className="shadow-2xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Taxa de Leitura</span>
              <Eye className="size-4 text-sky-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">
                {metrics?.readRate ?? 91.2}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Mensagens abertas pelos alunos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência Recuperada */}
        <Card className="shadow-2xs border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <span className="text-xs font-medium">Recuperado no Mês</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCents(metrics?.recoveredAmountCents ?? 425000)}
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1">
                <Zap className="size-3" />
                Recebido via régua automática
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="Seções de comunicação"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reguas"}
            onClick={() => setActiveTab("reguas")}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === "reguas"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BellRing className="size-4 shrink-0" />
            Réguas & Automações
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "historico"}
            onClick={() => setActiveTab("historico")}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === "historico"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <History className="size-4 shrink-0" />
            Histórico de Envios
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "conexao"}
            onClick={() => setActiveTab("conexao")}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === "conexao"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smartphone className="size-4 shrink-0" />
            Conexão WhatsApp
          </button>
        </div>

        <div role="tabpanel" className="space-y-4">
          {activeTab === "reguas" ? <AutomationRulesTab /> : null}
          {activeTab === "historico" ? <MessageLogsTab /> : null}
          {activeTab === "conexao" ? <ConnectionSettingsTab /> : null}
        </div>
      </div>

      {/* Send Message Dialog */}
      <SendMessageDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
      />
    </div>
  );
}
