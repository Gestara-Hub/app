import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { KindBadge, SlaBadge, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmSubmit } from "@/components/shared/confirm-submit";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { findErrorByReference } from "@/lib/server/health";
import { getThread, listMacros } from "@/lib/server/support";
import { cn } from "@/lib/utils";
import { reopenAction, resolveAction, urgentAction } from "../actions";
import { Composer, ScrollToEnd } from "./reply-forms";

export const metadata: Metadata = { title: "Conversa" };

const AUTHOR_LABEL = { customer: "Cliente", bot: "Assistente", staff: "Suporte", system: "Sistema" } as const;

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin("support:view");
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();
  const canReply = can(admin.role, "support:reply");
  const macros = canReply ? await listMacros() : [];
  // Conversa aberta a partir de um erro: o registro técnico (sem dado pessoal) já aparece aqui.
  const techError =
    thread.errorReference && can(admin.role, "health:view") ? await findErrorByReference(thread.errorReference) : null;

  return (
    <>
      <BackLink href="/support" label="Voltar ao Suporte" />
      <PageHeader title={thread.subject} description={`${thread.organizationName} · ${thread.userName}`}>
        <KindBadge kind={thread.kind} />
        <StatusBadge status={thread.status} />
        {thread.urgent ? <UrgentBadge /> : null}
        <SlaBadge status={thread.status} since={thread.lastCustomerMessageAt ?? thread.createdAt} now={new Date()} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-3">
              {thread.messages.map((message) => {
                const mine = message.author === "staff" || message.author === "bot";
                const who = message.internal ? "Nota interna" : AUTHOR_LABEL[message.author];
                const name = message.author === "staff" && message.staffName ? `${who} · ${message.staffName}` : who;
                return (
                  <div key={message.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                    <InitialsAvatar name={message.author === "customer" ? thread.userName : name} size="sm" className="size-8" />
                    <div
                      className={cn(
                        "min-w-0 max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm",
                        message.internal && "border-warning/40 bg-warning/10",
                        message.author === "customer" && "bg-muted/40",
                        message.author === "staff" && !message.internal && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{name}</span>
                        <span>{format(message.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <ScrollToEnd count={thread.messages.length} />
          {canReply ? <Composer threadId={thread.id} macros={macros} /> : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quem escreveu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="break-words font-medium">{thread.userName}</p>
              <p className="break-all text-muted-foreground">{thread.userEmail}</p>
              <p className="break-words">{thread.organizationName}</p>
              <p className="text-muted-foreground">Plano: {thread.planTier === "pro" ? "Profissional" : thread.planTier === "scale" ? "Expansão" : "Grátis"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contexto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p>
                <span className="text-muted-foreground">Tela: </span>
                <span className="break-all font-mono text-[11px]">{thread.originScreen ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Código do erro: </span>
                <span className="break-all font-mono text-[11px]">{thread.errorReference ?? "—"}</span>
              </p>
              {techError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                  <p className="font-medium">Erro registrado</p>
                  <p className="mt-1 break-all font-mono text-[11px]">{techError.event}</p>
                  <p className="mt-1 break-words">{techError.message}</p>
                  <p className="mt-1 text-muted-foreground">
                    {techError.count} {techError.count === 1 ? "ocorrência" : "ocorrências"} ·{" "}
                    <Link href={`/health?tab=erros&q=${encodeURIComponent(thread.errorReference ?? "")}`} className="underline underline-offset-2">
                      Ver em Saúde
                    </Link>
                  </p>
                </div>
              ) : null}
              {thread.clientInfo ? (
                <p className="break-words">
                  <span className="text-muted-foreground">Navegador: </span>
                  {thread.clientInfo}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Aberta em: </span>
                {format(thread.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
              {thread.botHelped !== null ? (
                <p>
                  <span className="text-muted-foreground">Assistente ajudou: </span>
                  {thread.botHelped ? "sim" : "não"}
                </p>
              ) : null}
              {thread.summary ? (
                <p className="rounded-md bg-muted p-2 text-xs break-words">
                  <span className="font-medium">Resumo: </span>
                  {thread.summary}
                </p>
              ) : null}
            </CardContent>
          </Card>
          {canReply ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {thread.status === "resolved" ? (
                  <form action={reopenAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <ConfirmSubmit title="Reabrir a conversa?" description="Ela volta para a fila de quem precisa de resposta." confirmLabel="Reabrir" className="w-full">
                      Reabrir
                    </ConfirmSubmit>
                  </form>
                ) : (
                  <form action={resolveAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <ConfirmSubmit title="Encerrar a conversa?" description="Ela sai da fila de respostas. Se o cliente escrever de novo, ela volta." confirmLabel="Encerrar" className="w-full">
                      Encerrar conversa
                    </ConfirmSubmit>
                  </form>
                )}
                <form action={urgentAction}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <input type="hidden" name="urgent" value={thread.urgent ? "0" : "1"} />
                  <Button type="submit" variant="outline" className="w-full">
                    {thread.urgent ? "Tirar a marca de urgente" : "Marcar como urgente"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
