"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Lock, Repeat } from "lucide-react";
import type { RecurringAuthorizationStatus } from "@gestarahub/contracts";
import { formatCents, formatDateTime } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { cn } from "@/lib/utils";
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import {
  useRecurringAuthorization,
  useRequestRecurring,
  useRevokeRecurring,
  useSimulateRecurringAuthorize,
} from "../hooks/use-recurring-authorization";

type DisplayStatus = RecurringAuthorizationStatus | "none";

const STATUS_LABEL: Record<DisplayStatus, string> = {
  none: "Não solicitado",
  pending: "Aguardando autorização",
  active: "Ativo",
  revoked: "Revogado",
};

const STATUS_CLASS: Record<DisplayStatus, string> = {
  none: "border-border/60 bg-muted/50 text-muted-foreground",
  pending: "border-warning/30 bg-warning/10 text-warning",
  active: "border-success/30 bg-success/10 text-success",
  revoked: "border-border/60 bg-muted/50 text-muted-foreground",
};

function digitsToCents(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface RecurringAuthorizationSectionProps {
  studentId: string;
  studentName: string;
  /** Preco do plano: limite sugerido e referencia do aviso. */
  planPriceCents?: number;
}

/**
 * Pix Automatico do aluno (simulado, docs/technical/05 secao 6.3): status e as
 * acoes Solicitar, Simular autorizacao (demo) e Revogar. Fica dentro do
 * formulario do aluno: todos os botoes sao type="button" e o campo do limite
 * nao envia o formulario com Enter.
 */
export function RecurringAuthorizationSection({
  studentId,
  studentName,
  planPriceCents,
}: RecurringAuthorizationSectionProps) {
  const hasFeature = useHasFeature();
  const can = useCan();
  const canManage = can("billing:manage");
  const hasOnline = hasFeature("online_payments");
  const { data: org } = useOrganization();
  const enabled = Boolean(org?.settings?.onlinePayments?.enabled);

  const query = useRecurringAuthorization(hasOnline ? studentId : undefined);
  const requestMut = useRequestRecurring();
  const authorizeMut = useSimulateRecurringAuthorize();
  const revokeMut = useRevokeRecurring();
  const { confirm, dialog } = useConfirmAction();

  const [requesting, setRequesting] = useState(false);
  const [limitCents, setLimitCents] = useState<number | null>(
    planPriceCents ?? null,
  );

  if (!hasOnline) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">Pix Automático</span>: a
          mensalidade é paga sozinha no vencimento. Disponível no Plano Pro.
          {can("subscription:manage") ? (
            <>
              {" "}
              <Link
                href={PLAN_SETTINGS_HREF}
                className="font-medium text-primary hover:underline"
              >
                Ver Plano Pro
              </Link>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const auth = query.data ?? null;
  const status: DisplayStatus = auth?.status ?? "none";
  const canRequest = status === "none" || status === "revoked";
  const overLimit =
    status === "active" &&
    auth &&
    planPriceCents !== undefined &&
    planPriceCents > auth.maxAmountCents;

  const startRequest = () => {
    setLimitCents(planPriceCents ?? null);
    setRequesting(true);
  };

  const sendRequest = () => {
    if (!limitCents || limitCents <= 0) {
      toast.error("Informe um limite maior que zero.");
      return;
    }
    requestMut.mutate(
      { studentId, maxAmountCents: limitCents },
      {
        onSuccess: () => {
          setRequesting(false);
          toast.success(
            "Solicitação enviada. Aguardando a autorização do aluno.",
          );
        },
        onError: (err) =>
          toast.error(
            getErrorMessage(
              err,
              "Não foi possível solicitar o Pix Automático.",
            ),
          ),
      },
    );
  };

  const simulateAuthorize = async () => {
    if (!auth) return;
    const ok = await confirm({
      title: "Simular autorização?",
      description: `Demonstração: faz de conta que ${studentName} autorizou o Pix Automático no app do banco, com limite de ${formatCents(auth.maxAmountCents)} por cobrança. As mensalidades vencidas até hoje dentro do limite são pagas na hora.`,
      confirmLabel: "Simular autorização",
    });
    if (!ok) return;
    authorizeMut.mutate(auth.id, {
      onSuccess: () => toast.success("Pix Automático ativo."),
      onError: (err) =>
        toast.error(
          getErrorMessage(err, "Não foi possível ativar o Pix Automático."),
        ),
    });
  };

  const revoke = async () => {
    if (!auth) return;
    const isPending = auth.status === "pending";
    const ok = await confirm({
      title: isPending
        ? "Cancelar a solicitação?"
        : "Revogar o Pix Automático?",
      description: isPending
        ? `A solicitação de Pix Automático de ${studentName} é cancelada.`
        : `As próximas mensalidades de ${studentName} deixam de ser pagas sozinhas e voltam a ser cobradas como antes. O que já foi pago continua pago.`,
      confirmLabel: isPending ? "Cancelar solicitação" : "Revogar",
      variant: "destructive",
    });
    if (!ok) return;
    revokeMut.mutate(auth.id, {
      onSuccess: () =>
        toast.success(
          isPending ? "Solicitação cancelada." : "Pix Automático revogado.",
        ),
      onError: (err) =>
        toast.error(
          getErrorMessage(err, "Não foi possível revogar o Pix Automático."),
        ),
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Repeat className="size-3.5 text-primary" aria-hidden />
          Pix Automático
        </span>
        {query.isLoading ? (
          <Skeleton className="h-5 w-28 rounded-full" />
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium",
              STATUS_CLASS[status],
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {query.isError ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Não foi possível carregar o Pix Automático.
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : query.isLoading ? null : (
        <>
          <p className="text-xs text-muted-foreground">
            {status === "active" && auth
              ? `Mensalidades até ${formatCents(auth.maxAmountCents)} são pagas sozinhas no vencimento.${auth.authorizedAt ? ` Autorizado em ${formatDateTime(auth.authorizedAt)}.` : ""}`
              : status === "pending" && auth
                ? `Limite de ${formatCents(auth.maxAmountCents)} por cobrança. Falta o aluno autorizar no app do banco.`
                : status === "revoked" && auth?.revokedAt
                  ? `Revogado em ${formatDateTime(auth.revokedAt)}. Pode solicitar de novo.`
                  : "Com a autorização do aluno, a mensalidade é paga sozinha no vencimento."}
          </p>

          {overLimit && auth ? (
            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-warning"
                aria-hidden
              />
              O plano ({formatCents(planPriceCents!)}) passa do limite
              autorizado. Essas mensalidades ficam em aberto e precisam ser
              cobradas de outra forma.
            </p>
          ) : null}

          {!enabled && canRequest ? (
            <p className="text-xs text-muted-foreground">
              A cobrança online está desligada em Configurações → Pagamento
              online.
            </p>
          ) : null}

          {canManage ? (
            requesting ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="recurring-limit" className="text-xs">
                    Limite por cobrança
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="recurring-limit"
                      inputMode="numeric"
                      placeholder="0,00"
                      className="pl-9"
                      value={centsToInput(limitCents)}
                      onChange={(e) =>
                        setLimitCents(digitsToCents(e.target.value))
                      }
                      onKeyDown={(e) => {
                        // Enter aqui nao salva o cadastro do aluno.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          sendRequest();
                        }
                      }}
                      disabled={requestMut.isPending}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRequesting(false)}
                    disabled={requestMut.isPending}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={sendRequest}
                    disabled={requestMut.isPending}
                  >
                    {requestMut.isPending
                      ? "Enviando..."
                      : "Enviar solicitação"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canRequest ? (
                  <span
                    title={
                      enabled
                        ? undefined
                        : "Ligue a cobrança online em Configurações → Pagamento online."
                    }
                    className="inline-flex"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startRequest}
                      disabled={!enabled}
                    >
                      Solicitar Pix Automático
                    </Button>
                  </span>
                ) : null}
                {status === "pending" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-dashed border-primary/50 text-primary"
                    onClick={() => void simulateAuthorize()}
                    disabled={authorizeMut.isPending}
                  >
                    <FlaskConical className="size-3.5" aria-hidden />
                    Simular autorização
                  </Button>
                ) : null}
                {status === "pending" || status === "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void revoke()}
                    disabled={revokeMut.isPending}
                  >
                    {status === "pending" ? "Cancelar solicitação" : "Revogar"}
                  </Button>
                ) : null}
              </div>
            )
          ) : null}
        </>
      )}
      {dialog}
    </div>
  );
}
