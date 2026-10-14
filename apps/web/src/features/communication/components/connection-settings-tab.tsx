"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, MessageCircle, Unplug } from "lucide-react";
import { toast } from "sonner";
import type { WhatsAppConnectionView } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { relativeDateLabel } from "@gestarahub/core/date";
import { formatPhone } from "@gestarahub/core/format";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/features/auth";
import { useUnit } from "@/features/settings";
import { whatsappNumber } from "@/lib/whatsapp";
import {
  useConnectOfficialWhatsApp,
  useDisconnectOfficialWhatsApp,
  useUpdateConnectionSettings,
  useWhatsAppConnection,
} from "../hooks/use-communication";

const ASSISTED_STEPS = [
  "Você toca no botão do WhatsApp (na mensalidade, no aniversariante, no aluno).",
  "O WhatsApp deste aparelho abre na conversa do aluno, com a mensagem pronta.",
  "Você confere e toca em enviar. O histórico registra \"Aberto no WhatsApp\".",
];

const OFFICIAL_STEPS = [
  "Entre com a conta da Meta do seu negócio (a mesma do Facebook ou Instagram da empresa).",
  "Escolha o número de WhatsApp do espaço.",
  "Depois da aprovação da Meta, as mensagens ligadas passam a sair sozinhas.",
];

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((step, i) => (
        <li key={step} className="flex gap-2.5 text-sm text-muted-foreground">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function phoneLabel(phone?: string): string {
  return phone ? formatPhone(phone.replace(/^55(?=\d{10,11}$)/, "")) : "";
}

function SendHoursForm({ connection, disabled }: { connection: WhatsAppConnectionView; disabled: boolean }) {
  const updateMut = useUpdateConnectionSettings();
  const [start, setStart] = useState(connection.allowedSendHours.start);
  const [end, setEnd] = useState(connection.allowedSendHours.end);
  const changed = start !== connection.allowedSendHours.start || end !== connection.allowedSendHours.end;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Horário de envio automático</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="send-start" className="text-xs">
            De
          </Label>
          <Input
            id="send-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={disabled}
            className="w-32 text-base md:text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="send-end" className="text-xs">
            Até
          </Label>
          <Input
            id="send-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={disabled}
            className="w-32 text-base md:text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !changed || updateMut.isPending}
          onClick={() =>
            updateMut.mutate(
              { allowedSendHours: { start, end } },
              {
                onSuccess: () => toast.success("Horário salvo."),
                onError: (err) => toast.error(getErrorMessage(err, "Não foi possível salvar o horário.")),
              },
            )
          }
        >
          {updateMut.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Fora desse horário, as mensagens automáticas esperam.</p>
    </div>
  );
}

/**
 * Conexao do WhatsApp: no gratis, explica o envio assistido e oferece o Pro;
 * no Pro, conecta o numero do proprio espaco a API oficial da Meta.
 */
export function ConnectionSettingsTab() {
  const { data: connection, isPending } = useWhatsAppConnection();
  const { data: unit } = useUnit();
  const canManage = useCan()("communication:manage");
  const connectMut = useConnectOfficialWhatsApp();
  const disconnectMut = useDisconnectOfficialWhatsApp();
  const { confirm, dialog } = useConfirmAction();

  if (isPending || !connection) return <Skeleton className="h-64 w-full rounded-xl" />;

  async function disconnect() {
    const ok = await confirm({
      title: "Desconectar o WhatsApp oficial?",
      description: "As mensagens automáticas param. Os botões voltam a abrir o WhatsApp do aparelho (envio assistido).",
      confirmLabel: "Desconectar",
      variant: "destructive",
    });
    if (!ok) return;
    disconnectMut.mutate(undefined, {
      onSuccess: () => toast.success("WhatsApp oficial desconectado."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível desconectar.")),
    });
  }

  const assistedCard = (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Envio assistido</h3>
        {connection.mode === "assisted" ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Em uso
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Não precisa conectar nada: as mensagens saem do WhatsApp do próprio aparelho, com o número do seu espaço.
      </p>
      <Steps items={ASSISTED_STEPS} />
    </section>
  );

  if (!connection.canUseOfficial) {
    return (
      <div className="space-y-4">
        {assistedCard}
        <FeatureLocked
          title="Envio automático pelo WhatsApp oficial"
          description="Conecte o número do seu espaço à API oficial do WhatsApp e deixe lembretes, boas-vindas e parabéns saírem sozinhos."
          benefits={[
            "Mensagens saem com o nome e o número do seu espaço",
            "Lembretes antes, no dia e depois do vencimento",
            "Boas-vindas, aniversário e alunos que pararam de vir",
            "Franquia mensal de mensagens inclusa no plano",
          ]}
        />
      </div>
    );
  }

  if (connection.officialStatus !== "connected") {
    const phone = unit?.phone;
    return (
      <div className="space-y-4">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Conectar o WhatsApp oficial</h3>
            <p className="text-sm text-muted-foreground">
              Use o número do seu espaço com a API oficial do WhatsApp. É uma conexão feita uma vez.
            </p>
          </div>
          <Steps items={OFFICIAL_STEPS} />
          <p className="text-xs text-muted-foreground">
            {phone
              ? `Número do espaço: ${formatPhone(phone)}.`
              : "Cadastre o telefone do espaço em Configurações antes de conectar."}
          </p>
          <Button
            type="button"
            disabled={!canManage || !whatsappNumber(phone) || connectMut.isPending}
            onClick={() =>
              connectMut.mutate(undefined, {
                onSuccess: () => toast.success("WhatsApp oficial conectado."),
                onError: (err) => toast.error(getErrorMessage(err, "Não foi possível conectar o WhatsApp oficial.")),
              })
            }
          >
            {connectMut.isPending ? "Conectando..." : "Conectar WhatsApp oficial"}
          </Button>
        </section>
        {assistedCard}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">WhatsApp oficial conectado</h3>
              <p className="text-sm text-muted-foreground">
                {connection.displayName} · {phoneLabel(connection.phoneNumber)}
                {connection.connectedAt
                  ? ` · desde ${relativeDateLabel(format(parseISO(connection.connectedAt), "yyyy-MM-dd"))}`
                  : ""}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canManage || disconnectMut.isPending}
            onClick={() => void disconnect()}
          >
            <Unplug className="size-4" />
            Desconectar
          </Button>
        </div>
        <div className="border-t border-border/60 pt-4">
          <SendHoursForm connection={connection} disabled={!canManage} />
        </div>
        <p className="text-xs text-muted-foreground">
          Franquia do mês: {connection.monthlyQuota.used} de {connection.monthlyQuota.included} mensagens.
        </p>
      </section>
      {dialog}
    </div>
  );
}
