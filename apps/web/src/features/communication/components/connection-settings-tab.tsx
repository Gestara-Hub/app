"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Info, Loader2, MessageCircle, Unplug } from "lucide-react";
import { toast } from "@/lib/toast";
import type { WhatsAppConnectionView } from "@gestarahub/contracts";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { relativeDateLabel, dateInSpace } from "@gestarahub/core/date";
import { formatPhone } from "@gestarahub/core/format";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { MetaCostNotice } from "@/components/shared/meta-cost-notice";
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
import { useMetaEmbeddedSignup } from "../hooks/use-meta-embedded-signup";
import { TestWhatsAppDialog } from "./test-whatsapp-dialog";

const ASSISTED_STEPS = [
  "Você toca no botão do WhatsApp (na mensalidade, no aniversariante, no aluno).",
  "O WhatsApp deste aparelho abre na conversa do aluno, com a mensagem pronta.",
  "Você confere e toca em enviar. O histórico registra \"Aberto no WhatsApp\".",
];

const OFFICIAL_STEPS = [
  "Entre com a conta da Meta do seu negócio (a mesma do Facebook ou Instagram da empresa).",
  "Escolha o número de WhatsApp do espaço.",
  "Cadastre um cartão na sua conta do WhatsApp na Meta: é ele que paga as mensagens.",
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
                // Sem campo destacado na tela: mostra a regra (nao "Verifique os campos").
                onError: (err) =>
                  toast.error(getFieldErrors(err)?.[0]?.message ?? getErrorMessage(err, "Não foi possível salvar o horário.")),
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
  const can = useCan();
  const canManage = can("communication:manage");
  const canManagePlan = can("subscription:manage");
  const connectMut = useConnectOfficialWhatsApp();
  const disconnectMut = useDisconnectOfficialWhatsApp();
  const { confirm, dialog } = useConfirmAction();
  const { launchSignup, isSigningUp, isConfigured } = useMetaEmbeddedSignup();
  const phone = unit?.phone;

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
          canManagePlan={canManagePlan}
          benefits={[
            "Mensagens saem com o nome e o número do seu espaço",
            "Lembretes antes, no dia e depois do vencimento",
            "Boas-vindas, aniversário e alunos que pararam de vir",
            "Mensagens pagas por você, direto à Meta, na sua conta",
          ]}
        />
      </div>
    );
  }

  // Ainda sem o numero de cada espaco (doc technical/07 §1.1): em producao, so o assistido.
  if (!connection.officialAvailable && connection.officialStatus !== "connected") {
    return (
      <div className="space-y-4">
        {assistedCard}
        <section className="space-y-2 rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Envio automático: em breve</h3>
          <p className="text-sm text-muted-foreground">
            Em breve, lembretes, boas-vindas e parabéns vão sair sozinhos pelo número do seu espaço. Até lá, use o envio assistido.
          </p>
        </section>
      </div>
    );
  }

  if (connection.officialStatus !== "connected") {
    const hasPhone = Boolean(phone && whatsappNumber(phone));

    return (
      <div className="space-y-4">
        <section className="space-y-5 rounded-xl border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Conectar o WhatsApp oficial</h3>
            <p className="text-sm text-muted-foreground">
              Use o número do seu espaço com a API oficial do WhatsApp. É uma conexão feita uma vez.
            </p>
          </div>

          <Steps items={OFFICIAL_STEPS} />

          {/* Antes de conectar: fica claro que as mensagens sao pagas pelo espaco a Meta. */}
          <MetaCostNotice showLink={false} />

          {isConfigured ? (
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>Você escolhe e confirma o número na janela da Meta. Depois, ele fica salvo no seu espaço.</span>
            </div>
          ) : hasPhone ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Número do espaço: <strong className="font-semibold text-foreground">{formatPhone(phone!)}</strong>.
                </span>
              </span>
              <Link href="/settings#phone" className="shrink-0 font-medium text-primary hover:underline">
                Alterar
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Cadastre o telefone do espaço em Configurações antes de conectar.</span>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0 font-medium gap-1 border-amber-500/40 bg-background/60 hover:bg-background">
                <Link href="/settings">
                  Cadastrar telefone agora
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}

          {/* Um botao so (31/10/2026): com o app da Meta configurado, o cadastro guiado
              (o numero vem de la); sem ele (desenvolvimento e testes), conecta pelo
              telefone do espaco. Saiu o "modo Sandbox", jargao que aparecia ao cliente. */}
          <Button
            type="button"
            disabled={!canManage || connectMut.isPending || isSigningUp || (!isConfigured && !hasPhone)}
            onClick={async () => {
              const onError = (err: unknown) =>
                toast.error(getFieldErrors(err)?.[0]?.message ?? getErrorMessage(err, "Não foi possível conectar o WhatsApp oficial."));
              if (!isConfigured) {
                connectMut.mutate(undefined, { onSuccess: () => toast.success("WhatsApp oficial conectado."), onError });
                return;
              }
              try {
                const result = await launchSignup({ businessName: unit?.name, phone: phone ?? undefined });
                // Sem o codigo ou sem os dados do numero, a Meta nao concluiu: nao cai
                // na conexao pelo telefone do espaco, que nao e o caso aqui.
                if (!result.code || !result.phoneNumberId || !result.wabaId) {
                  toast.error("A Meta não confirmou a conexão. Tente de novo.");
                  return;
                }
                connectMut.mutate(
                  {
                    code: result.code,
                    phoneNumberId: result.phoneNumberId,
                    wabaId: result.wabaId,
                    businessId: result.businessId,
                    onboarding: result.onboarding,
                  },
                  { onSuccess: () => toast.success("WhatsApp oficial conectado."), onError },
                );
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "A conexão com a Meta foi cancelada.");
              }
            }}
          >
            {isSigningUp || connectMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSigningUp ? "Esperando a confirmação na Meta..." : connectMut.isPending ? "Conectando..." : "Conectar WhatsApp oficial"}
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
              {!connection.officialAvailable ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Envio automático pausado até o número do seu espaço ser ligado. Use o envio assistido.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {connection.displayName} · {phoneLabel(connection.phoneNumber)}
                {connection.connectedAt
                  ? ` · desde ${relativeDateLabel(dateInSpace(connection.connectedAt))}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Ferramenta de desenvolvimento: fora do build de producao (a acao tambem recusa). */}
            {process.env.NODE_ENV !== "production" && canManage ? (
              <TestWhatsAppDialog connectedPhone={connection.phoneNumber || phone} />
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || disconnectMut.isPending}
              onClick={() => void disconnect()}
            >
              <Unplug className="size-4" />
              Desconectar
            </Button>
          </div>
        </div>
        <div className="border-t border-border/60 pt-4">
          <SendHoursForm connection={connection} disabled={!canManage} />
        </div>
        {/* Sem franquia desde 17/11/2026: o espaco paga a Meta direto (doc technical/07 §1.5). */}
        <MetaCostNotice />
      </section>
      {dialog}
    </div>
  );
}
