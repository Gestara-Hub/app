"use client";

import { useState } from "react";
import { formatDateTime, formatPhone } from "@gestarahub/core/format";
import {
  Battery,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Unplug,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useSendMessage,
  useUpdateSessionSettings,
  useWhatsAppSession,
} from "../hooks/use-communication";

export function ConnectionSettingsTab() {
  const { data: session, isLoading } = useWhatsAppSession();
  const connectMutation = useConnectWhatsApp();
  const disconnectMutation = useDisconnectWhatsApp();
  const updateSettingsMutation = useUpdateSessionSettings();
  const sendMutation = useSendMessage();

  const [startHour, setStartHour] = useState(
    session?.allowedSendHours?.start || "08:00",
  );
  const [endHour, setEndHour] = useState(
    session?.allowedSendHours?.end || "20:00",
  );
  const [testPhone, setTestPhone] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const isConnected = session?.status === "connected";
  const isQrReady = session?.status === "qr_ready";

  const handleConnect = async () => {
    try {
      await connectMutation.mutateAsync();
      toast.success(
        isQrReady
          ? "WhatsApp Conectado! Sessão pareada e pronta para automações."
          : "QR Code gerado. Aponte a câmera do seu smartphone.",
      );
    } catch {
      toast.error("Não foi possível conectar a instância do WhatsApp.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      toast.success("WhatsApp desconectado. As automações estão pausadas.");
    } catch {
      toast.error("Não foi possível desconectar a sessão.");
    }
  };

  const handleSaveHours = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        allowedSendHours: { start: startHour, end: endHour },
      });
      toast.success(`Disparos serão realizados apenas entre ${startHour} e ${endHour}.`);
    } catch {
      toast.error("Não foi possível atualizar a janela de envio.");
    }
  };

  const handleSendTestMessage = async () => {
    const cleanPhone = testPhone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Informe um número de telefone com DDD para receber o teste.");
      return;
    }

    setIsTesting(true);
    try {
      await sendMutation.mutateAsync({
        recipientName: "Teste de Conexão",
        recipientPhone: cleanPhone,
        content:
          "Olá! Esta é uma mensagem de teste enviada pelo GestaraHub para validar a sua conexão do WhatsApp. Tudo está funcionando perfeitamente! 🚀",
        trigger: "manual_broadcast",
      });
      toast.success(`Disparo realizado para ${formatPhone(cleanPhone)}. Verifique no histórico.`);
      setTestPhone("");
    } catch {
      toast.error("Falha no envio de teste. Verifique o número e tente novamente.");
    } finally {
      setIsTesting(false);
    }
  };

  const quotaUsed = session?.monthlyQuota?.used ?? 342;
  const quotaTotal = session?.monthlyQuota?.included ?? 1000;
  const quotaPercent = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Carregando dados da conexão...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Bloco 1: Status da Conexão WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="size-4 text-primary" />
                Instância do WhatsApp
              </CardTitle>
              <CardDescription className="text-xs">
                Gerencie o pareamento do número comercial do seu negócio com a API oficial do GestaraHub.
              </CardDescription>
            </div>

            {isConnected ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 gap-1.5 w-fit">
                <CheckCircle2 className="size-3 text-emerald-600" />
                Conectado e Operacional
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 gap-1.5 w-fit">
                <Unplug className="size-3 text-amber-600" />
                Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isConnected ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between border-b pb-3 border-border">
                  <span className="text-xs text-muted-foreground">Número Pareado:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPhone(session?.phoneNumber || "5511987654321")}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-3 border-border">
                  <span className="text-xs text-muted-foreground">Nome da Instância:</span>
                  <span className="text-sm font-medium text-foreground">
                    {session?.profileName || "GestaraHub Gateway"}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-3 border-border">
                  <span className="text-xs text-muted-foreground">Bateria do Aparelho:</span>
                  <span className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Battery className="size-3.5 text-emerald-600" />
                    {session?.batteryLevel ?? 94}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Conectado Desde:</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {session?.connectedAt ? formatDateTime(session.connectedAt) : "Há 30 dias"}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Send className="size-3.5 text-primary" />
                    Enviar Mensagem de Teste
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Dispare uma mensagem imediata para seu próprio celular para verificar a entrega.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="(11) 99999-9999"
                      value={testPhone}
                      onChange={(e) => setTestPhone(formatPhone(e.target.value))}
                      className="text-xs h-9"
                    />
                    <Button
                      size="sm"
                      className="h-9 gap-1.5 text-xs shrink-0"
                      onClick={handleSendTestMessage}
                      disabled={isTesting}
                    >
                      <Send className="size-3.5" />
                      {isTesting ? "Enviando..." : "Testar"}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unplug className="size-3.5" />
                    Desconectar WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-6">
              {/* QR Code Container */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex size-52 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-muted/30 p-4">
                  {isQrReady ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <QrCode className="size-32 text-foreground animate-in fade-in duration-300" />
                      <span className="text-[10px] text-muted-foreground">
                        Expira em 45 segundos
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <QrCode className="size-16 opacity-30" />
                      <span className="text-xs">Clique para gerar o código</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={connectMutation.isPending}
                  className="gap-2 text-xs w-full max-w-[208px]"
                >
                  <RefreshCw className={`size-3.5 ${connectMutation.isPending ? "animate-spin" : ""}`} />
                  {isQrReady ? "Simular Pareamento Concluído" : "Gerar QR Code de Conexão"}
                </Button>
              </div>

              {/* Step by step */}
              <div className="max-w-md space-y-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Como conectar o WhatsApp do seu negócio:
                </h4>
                <ol className="space-y-3 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      1
                    </span>
                    <span>Abra o <strong>WhatsApp</strong> no celular que atende os clientes e alunos.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      2
                    </span>
                    <span>Toque no menu de <strong>Configurações</strong> e selecione <strong>Aparelhos conectados</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      3
                    </span>
                    <span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.</span>
                  </li>
                </ol>

                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span>Conexão criptografada de ponta a ponta com redundância de servidores.</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 2: Janela de Envio & Franquia Pro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Janela de Envio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Janela Permitida para Disparos
            </CardTitle>
            <CardDescription className="text-xs">
              Evite incomodar seus alunos em horários impróprios (madrugada/noite). Mensagens fora dessa janela são enfileiradas para o próximo horário útil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-hour" className="text-xs">Início dos Disparos</Label>
                <Input
                  id="start-hour"
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-hour" className="text-xs">Término dos Disparos</Label>
                <Input
                  id="end-hour"
                  type="time"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="text-xs w-full"
              onClick={handleSaveHours}
              disabled={updateSettingsMutation.isPending}
            >
              Salvar Janela de Horário
            </Button>
          </CardContent>
        </Card>

        {/* Franquia de Mensagens Pro */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="size-4 text-emerald-600" />
                Franquia Mensal (Plano Pro)
              </CardTitle>
              <Badge variant="secondary" className="text-[11px] font-normal">
                Renova dia 1º
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Envios de lembretes e automações incluídos no seu plano GestaraHub Pro sem custo extra de API Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {quotaUsed} de {quotaTotal} disparos utilizados
                </span>
                <span className="text-muted-foreground">{quotaPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sua franquia é mais que suficiente para até 300 alunos com lembretes completos de vencimento, cobrança amigável e boas-vindas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
