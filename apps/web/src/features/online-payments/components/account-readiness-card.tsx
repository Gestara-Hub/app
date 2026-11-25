"use client";

import { CheckCircle2, Circle, Clock, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { AsaasDocumentStatus, SubaccountOnboardingView } from "@gestarahub/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { openSupport } from "@/features/support";
import { setSeenMark, useSeenMark } from "@/lib/seen-marks";

/** Entrada do Asaas: senha, documentos e dados da conta (sem link de envio). */
export const ASAAS_LOGIN_URL = "https://www.asaas.com/login";

const DOC_STATUS: Record<AsaasDocumentStatus, { label: string; tone: string }> = {
  NOT_SENT: { label: "Falta enviar", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  PENDING: { label: "Em análise", tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  APPROVED: { label: "Aprovado", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  REJECTED: { label: "Recusado", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  IGNORED: { label: "Dispensado", tone: "" },
};

type StepState = "done" | "now" | "waiting" | "failed";

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  if (state === "failed") return <XCircle className="size-5 shrink-0 text-destructive" aria-hidden />;
  if (state === "waiting") return <Clock className="size-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />;
  return <Circle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
}

function Step({ state, title, children }: { state: StepState; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <StepIcon state={state} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={cn("text-sm font-medium", state === "done" && "text-muted-foreground")}>{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * "Deixe sua conta pronta" (25/11/2026): enquanto o Asaas nao aprova a conta,
 * mostra a situacao real da analise e leva a pessoa ao Asaas para criar a senha
 * e enviar os documentos (pelo link de envio, quando o Asaas fornece). Some com
 * a aprovacao geral.
 */
export function AccountReadinessCard({
  organizationId,
  onboarding,
  refreshing,
  onRefresh,
}: {
  organizationId: string;
  onboarding: SubaccountOnboardingView;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // O Asaas nao informa se a senha ja foi criada (25/11/2026): a pessoa marca, e a
  // marca fica na conta. Documento enviado tambem conta como senha criada.
  const passwordKey = `gestarahub:asaas-password-created:${organizationId}`;
  const passwordMarked = useSeenMark(passwordKey);
  const { status, documents, rejectReasons } = onboarding;
  const rejected = status.general === "REJECTED";
  const inReview = status.general === "AWAITING_APPROVAL";
  const anySent = documents.some((d) => d.status !== "NOT_SENT") || status.documentation === "AWAITING_APPROVAL" || status.documentation === "APPROVED";
  const missing = documents.filter((d) => d.status === "NOT_SENT" || d.status === "REJECTED");
  const docsState: StepState =
    status.documentation === "APPROVED" ? "done" : status.documentation === "REJECTED" || documents.some((d) => d.status === "REJECTED") ? "failed" : missing.length === 0 && anySent ? "waiting" : "now";

  return (
    <Card className="border-amber-500/30" data-testid="account-readiness">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{rejected ? "O Asaas recusou a conta" : "Deixe sua conta pronta"}</CardTitle>
          <CardDescription>
            {rejected
              ? "Veja o motivo e fale com a gente para resolver."
              : inReview
                ? "Tudo enviado. O Asaas analisa em até 48 horas."
                : "Crie a senha e envie os documentos no Asaas."}
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={refreshing} className="shrink-0">
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Atualizar situação
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-4">
          <Step state="done" title="Conta criada" />
          <Step state={anySent || passwordMarked ? "done" : "now"} title="Crie a senha no Asaas">
            {!anySent && !passwordMarked ? (
              <>
                <p className="text-xs text-muted-foreground">
                  No e-mail &quot;Bem-vindo ao Asaas&quot;. O link vale 10 minutos; depois, use &quot;Esqueci minha senha&quot;.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={ASAAS_LOGIN_URL} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                      Abrir o Asaas
                    </a>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSeenMark(passwordKey)}>
                    <CheckCircle2 className="size-4" />
                    Já criei a senha
                  </Button>
                </div>
              </>
            ) : null}
          </Step>
          <Step state={docsState} title="Envie os documentos">
            {documents.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {documents.map((doc) => {
                  const tag = DOC_STATUS[doc.status];
                  const needsAction = doc.status === "NOT_SENT" || doc.status === "REJECTED";
                  return (
                    <li key={doc.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="min-w-0 break-words">{doc.title}</span>
                          <Badge variant="outline" className={cn("font-normal", tag.tone)}>
                            {tag.label}
                          </Badge>
                        </p>
                        {doc.description ? <p className="break-words text-xs text-muted-foreground">{doc.description}</p> : null}
                      </div>
                      {needsAction ? (
                        <Button asChild variant="outline" className="shrink-0">
                          <a href={doc.onboardingUrl ?? ASAAS_LOGIN_URL} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                            Enviar no Asaas
                          </a>
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Entre no Asaas e siga o pedido de documentos da conta.</p>
            )}
          </Step>
          <Step
            state={rejected ? "failed" : status.general === "APPROVED" ? "done" : inReview ? "waiting" : "now"}
            title="Análise do Asaas"
          >
            <p className="text-xs text-muted-foreground">
              {rejected
                ? rejectReasons || "O Asaas não informou o motivo."
                : "Até 48 horas depois do envio. Os saques liberam com a aprovação."}
            </p>
            {rejected ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  openSupport({ direct: true, draft: "O Asaas recusou a minha conta de recebimento. Podem me ajudar?" })
                }
              >
                Falar com o suporte
              </Button>
            ) : null}
          </Step>
        </ol>
        <p className="text-xs text-muted-foreground">A situação atualiza sozinha quando o Asaas responder.</p>
      </CardContent>
    </Card>
  );
}
