"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import type { WhatsAppConnectionView, WhatsAppMetaHealth } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { META_BILLING_URL } from "@/lib/whatsapp/meta-cost";
import { META_NAME_STATUS_LABEL, META_QUALITY_LABEL, META_SEND_STATE_LABEL } from "@/lib/whatsapp/meta-health";
import { useRefreshMetaHealth } from "../hooks/use-communication";

/**
 * Situacao do numero e da conta do WhatsApp do espaco na Meta (doc
 * technical/07 §1.6), na aba Conexao: envio liberado ou bloqueado, pagamento,
 * nome exibido, qualidade e limite diario. A rotina confere de hora em hora;
 * "Atualizar" confere agora.
 */

type Tone = "ok" | "wait" | "bad" | "neutral";

function toneClass(tone: Tone): string {
  if (tone === "bad") return "text-destructive";
  if (tone === "wait") return "text-amber-700 dark:text-amber-300";
  if (tone === "neutral") return "text-foreground";
  return "text-emerald-700 dark:text-emerald-400";
}

function Row({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words text-right font-medium", toneClass(tone))}>{value}</span>
    </div>
  );
}

function dailyLimitLabel(limit: number | null | undefined): string {
  if (limit === null) return "Sem limite";
  if (limit === undefined) return "Ainda não definido";
  return `${limit.toLocaleString("pt-BR")} conversas por dia`;
}

function Summary({ health }: { health: WhatsAppMetaHealth }) {
  if (health.paymentBlocked) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground">Mensagens automáticas bloqueadas por falta de pagamento</p>
          <p className="break-words text-muted-foreground">
            Cadastre um cartão na sua conta do WhatsApp na Meta. Depois, toque em Atualizar.
          </p>
          <a
            href={META_BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Cadastrar pagamento na Meta
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }
  if (health.sendState === "blocked") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="break-words text-foreground">A Meta está bloqueando as mensagens automáticas. Veja o motivo abaixo.</p>
      </div>
    );
  }
  if (health.nameStatus === "pending_review") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="break-words text-foreground">
          Tudo certo para enviar. O nome do número está em análise na Meta; até aprovar, o limite diário fica menor.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p className="break-words text-foreground">Tudo certo na Meta: as mensagens automáticas podem sair.</p>
    </div>
  );
}

export function MetaHealthPanel({ connection, canManage }: { connection: WhatsAppConnectionView; canManage: boolean }) {
  const refresh = useRefreshMetaHealth();
  const health = connection.metaHealth;

  const onRefresh = () =>
    refresh.mutate(undefined, {
      onSuccess: () => toast.success("Situação na Meta atualizada."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível consultar a Meta agora.")),
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Situação na Meta</h4>
          <p className="text-xs text-muted-foreground">
            {health ? `Atualizado em ${formatDateTime(health.checkedAt)}` : "Ainda não consultada."}
          </p>
        </div>
        <Button type="button" variant="outline" disabled={!canManage || refresh.isPending} onClick={onRefresh}>
          {refresh.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Atualizar
        </Button>
      </div>

      {health ? (
        <>
          <Summary health={health} />
          <div className="divide-y rounded-lg border px-3.5">
            <Row
              label="Mensagens automáticas"
              value={META_SEND_STATE_LABEL[health.sendState]}
              tone={health.sendState === "blocked" ? "bad" : health.sendState === "limited" ? "wait" : "ok"}
            />
            <Row
              label="Pagamento na Meta"
              value={health.paymentBlocked ? "Sem cartão válido" : "Em dia"}
              tone={health.paymentBlocked ? "bad" : "ok"}
            />
            {health.nameStatus ? (
              <Row
                label="Nome do número"
                value={META_NAME_STATUS_LABEL[health.nameStatus]}
                tone={health.nameStatus === "declined" ? "bad" : health.nameStatus === "approved" ? "ok" : "wait"}
              />
            ) : null}
            {health.quality ? (
              <Row
                label="Qualidade do número"
                value={META_QUALITY_LABEL[health.quality]}
                tone={health.quality === "red" ? "bad" : health.quality === "yellow" ? "wait" : "ok"}
              />
            ) : null}
            <Row label="Limite da Meta" value={dailyLimitLabel(health.dailyLimit)} tone="neutral" />
          </div>
          {health.issues.filter((i) => !i.payment).length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {health.issues
                .filter((i) => !i.payment)
                .map((issue) => (
                  <li key={issue.code} className="break-words">
                    {issue.text}
                  </li>
                ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
