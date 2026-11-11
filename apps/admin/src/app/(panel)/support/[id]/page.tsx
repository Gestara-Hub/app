import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { formatProtocol } from "@gestarahub/core/support-protocol";
import { BugStatusBadge, KindBadge, ProtocolTag, RegressionBadge, SlaBadge, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmSubmit } from "@/components/shared/confirm-submit";
import { CrumbList } from "@/components/health/crumb-list";
import { TimelineList } from "@/components/health/timeline-list";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { parseCrumbs } from "@/lib/crumbs-view";
import { contextRows } from "@/lib/error-view";
import { userTimeline } from "@/lib/server/activity";
import { findErrorByReference, getOccurrenceByReference } from "@/lib/server/health";
import { getThread, listMacros } from "@/lib/server/support";
import { cn } from "@/lib/utils";
import { BUG_STATUSES, BUG_STATUS_LABEL } from "@/lib/support-types";
import { bugStatusAction, reopenAction, resolveAction, urgentAction } from "../actions";
import { Composer } from "./reply-forms";
import { SupportSidebar } from "./support-sidebar";

// O título do navegador leva o protocolo.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const thread = await getThread((await params).id);
  return { title: thread ? `${formatProtocol(thread.number)} · Conversa` : "Conversa" };
}

const AUTHOR_LABEL = { customer: "Cliente", bot: "Assistente", staff: "Suporte", system: "Sistema" } as const;

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin("support:view");
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();
  const canReply = can(admin.role, "support:reply");
  const macros = canReply ? await listMacros() : [];
  // Conversa aberta a partir de um erro: o registro técnico (sem dado pessoal) já aparece aqui.
  const canSeeHealth = can(admin.role, "health:view");
  const [techError, occurrence, nearby] = canSeeHealth
    ? await Promise.all([
        thread.errorReference ? findErrorByReference(thread.errorReference) : null,
        thread.errorReference ? getOccurrenceByReference(thread.errorReference) : null,
        // O que a pessoa fez e os erros dela na hora do relato (30 min antes e depois), com ou sem código.
        userTimeline({ userId: thread.userId, organizationId: thread.organizationId, around: thread.createdAt, windowMinutes: 30, limit: 15 }),
      ])
    : [null, null, []];

  // Passos do erro que a pessoa viu (se o código tem); senão os do próprio relato.
  const occurrenceCrumbs = parseCrumbs(occurrence?.context.breadcrumbs);
  const crumbs = occurrenceCrumbs.length > 0 ? occurrenceCrumbs : thread.breadcrumbs;
  const diagnosticCount = (techError ? 1 : 0) + (crumbs.length > 0 ? 1 : 0) + nearby.length;
  const hasError = Boolean(techError || thread.errorReference);

  return (
    <>
      <BackLink href="/support" label="Voltar ao Suporte" />
      <PageHeader title={thread.subject} description={`${thread.organizationName} · ${thread.userName}`}>
        <ProtocolTag number={thread.number} />
        <KindBadge kind={thread.kind} />
        <BugStatusBadge status={thread.bugStatus} />
        <RegressionBadge regressed={thread.regressed} />
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
                        <RelativeTime date={message.createdAt} />
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {canReply ? <Composer threadId={thread.id} macros={macros} /> : null}
        </div>

        <SupportSidebar
          hasError={hasError}
          diagnosticCount={diagnosticCount}
          attendance={
            <>
              {canReply ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ações</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {thread.status === "resolved" ? (
                      <form action={reopenAction}>
                        <input type="hidden" name="threadId" value={thread.id} />
                        <ConfirmSubmit title="Reabrir a conversa?" description="Ela volta para a fila de quem precisa de resposta." confirmLabel="Reabrir" className="w-full">
                          Reabrir conversa
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quem escreveu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="break-words font-medium">{thread.userName}</p>
                    <p className="break-all text-xs text-muted-foreground">{thread.userEmail}</p>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Espaço</p>
                    <Link
                      href={`/spaces/${thread.organizationId}`}
                      className="break-words font-medium text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      {thread.organizationName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Plano: {thread.planTier === "pro" ? "Profissional" : thread.planTier === "scale" ? "Expansão" : "Grátis"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
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
                    <p className="text-xs text-destructive">
                      Erro registrado vinculado. Veja a aba <span className="font-medium">Diagnóstico</span>.
                    </p>
                  ) : null}
                  {thread.clientInfo ? (
                    <p className="break-words">
                      <span className="text-muted-foreground">Navegador: </span>
                      {thread.clientInfo}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-muted-foreground">Aberta: </span>
                    <RelativeTime date={thread.createdAt} />
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

              {thread.kind === "bug" ? (
                <Card className={cn(thread.regressed && "border-destructive/50")}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Andamento do bug</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {thread.regression ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                        <span className="font-medium">O erro voltou depois da correção.</span> {thread.regression.count}{" "}
                        {thread.regression.count === 1 ? "ocorrência" : "ocorrências"}, a última <RelativeTime date={thread.regression.lastAt} />
                        {thread.regression.lastRelease ? <> na versão <span className="font-mono">{thread.regression.lastRelease}</span></> : null}
                        {thread.fixedIn && thread.regression.lastRelease && thread.regression.lastRelease !== thread.fixedIn ? (
                          <> (a correção foi na versão <span className="font-mono">{thread.fixedIn}</span>: pode ser um deploy ainda não feito)</>
                        ) : null}
                        .
                      </p>
                    ) : null}
                    {thread.bugStatus === "fixed" && !thread.regression ? (
                      <p className="text-xs text-muted-foreground">
                        Corrigido <RelativeTime date={thread.fixedAt} />
                        {thread.fixedIn ? <> na versão <span className="font-mono">{thread.fixedIn}</span></> : null}. Se o erro voltar, o painel avisa aqui.
                      </p>
                    ) : null}
                    {canReply ? (
                      // `key` com o andamento salvo: o React limpa o formulario depois
                      // da action e o <select> voltava ao valor da primeira montagem
                      // ("Novo"); quem clicava de novo gravava "Novo" por cima.
                      <form key={`${thread.bugStatus ?? "new"}:${thread.fixedIn ?? ""}`} action={bugStatusAction} className="space-y-2">
                        <input type="hidden" name="threadId" value={thread.id} />
                        <select
                          name="status"
                          defaultValue={thread.bugStatus ?? "new"}
                          aria-label="Andamento do bug"
                          className="h-9 w-full rounded-md border bg-background px-3 text-base md:text-sm"
                        >
                          {BUG_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {BUG_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                        <input
                          name="fixedIn"
                          defaultValue={thread.fixedIn ?? ""}
                          maxLength={80}
                          placeholder="Corrigido na versão (opcional)"
                          aria-label="Corrigido na versão"
                          className="h-9 w-full rounded-md border bg-background px-3 text-base md:text-sm"
                        />
                        <Button type="submit" variant="outline" className="w-full">
                          Salvar andamento
                        </Button>
                      </form>
                    ) : (
                      <p className="text-muted-foreground">{thread.bugStatus ? BUG_STATUS_LABEL[thread.bugStatus] : "Sem andamento"}</p>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </>
          }
          diagnostic={
            <>
              {techError ? (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-destructive">Erro técnico registrado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <p className="break-all font-mono font-medium text-[11px]">{techError.event}</p>
                    <p className="break-words text-foreground">{techError.message}</p>
                    {occurrence ? (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-destructive/20 pt-2">
                        {contextRows(occurrence.context).map((row) => (
                          <div key={row.key} className="contents">
                            <dt className="text-muted-foreground">{row.label}</dt>
                            <dd className="min-w-0 break-all font-mono text-[11px]">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <p className="pt-1 text-muted-foreground">
                      {techError.count} {techError.count === 1 ? "ocorrência" : "ocorrências"} ·{" "}
                      <Link href={`/health/errors/${techError.id}`} className="underline underline-offset-2">
                        Ver o erro na Saúde
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {crumbs.length > 0 ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Passos antes {occurrenceCrumbs.length > 0 ? "do erro" : "do relato"}</CardTitle>
                    <p className="text-xs text-muted-foreground">Telas abertas e ações, sem dados digitados.</p>
                  </CardHeader>
                  <CardContent>
                    <CrumbList crumbs={crumbs} empty="" />
                  </CardContent>
                </Card>
              ) : null}

              {canSeeHealth ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Em volta do relato</CardTitle>
                    <p className="text-xs text-muted-foreground">O que esta pessoa fez e os erros dela, de 30 min antes a 30 min depois.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <TimelineList items={nearby} compact empty="Nada registrado dela nesse intervalo." />
                    <Link href={`/health/users/${encodeURIComponent(thread.userId)}`} className="block text-xs underline underline-offset-2">
                      Linha do tempo completa desta pessoa
                    </Link>
                  </CardContent>
                </Card>
              ) : null}

              {!techError && crumbs.length === 0 && (!nearby || nearby.length === 0) ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum dado técnico de diagnóstico registrado para esta conversa.
                  </CardContent>
                </Card>
              ) : null}
            </>
          }
        />
      </div>
    </>
  );
}
