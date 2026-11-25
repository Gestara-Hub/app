import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BugStatusBadge, ProtocolTag } from "@/components/support/badges";
import { can } from "@/lib/permissions";
import { CrumbList } from "@/components/health/crumb-list";
import { parseCrumbs } from "@/lib/crumbs-view";
import { contextRows, splitStack } from "@/lib/error-view";
import { requireAdmin } from "@/lib/server/context";
import { getErrorDetail } from "@/lib/server/health";
import { markKnownAction, unmarkKnownAction } from "../../actions";

export const metadata: Metadata = { title: "Erro" };

const SOURCE_LABEL: Record<string, string> = { server: "Servidor", browser: "Navegador", cron: "Rotina", webhook: "Aviso do parceiro" };
const STATUS_LABEL: Record<string, string> = { bot: "Com o assistente", waiting_us: "Precisa de resposta", waiting_customer: "Aguardando o cliente", resolved: "Encerrada" };

/** Um erro por inteiro: onde, mensagem, pilha, contexto da última vez e as conversas com o código. Sem dado pessoal. */
export default async function ErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin("health:view");
  const { id } = await params;
  const error = await getErrorDetail(id);
  if (!error) notFound();
  const context = contextRows(error.context);
  const stack = error.stack ? splitStack(error.stack) : null;
  // Os passos da ocorrência mais recente que os tem (o navegador manda depois do erro).
  const withCrumbs = error.occurrences.find((o) => parseCrumbs(o.context.breadcrumbs).length > 0);

  return (
    <>
      <BackLink href={error.organizationId ? `/spaces/${error.organizationId}?tab=saude` : "/health"} />
      <PageHeader title="Detalhe do erro" description={error.message}>
        <Badge variant="secondary" className="font-normal">
          {SOURCE_LABEL[error.source] ?? error.source}
        </Badge>
        {error.level === "warn" ? (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 font-normal text-amber-700 dark:text-amber-300"
          >
            Aviso
          </Badge>
        ) : null}
        {error.known ? <Badge className="font-normal">Conhecido</Badge> : null}
      </PageHeader>
      <p className="-mt-3 mb-6 break-all font-mono text-xs text-muted-foreground">{error.event}</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-sm">{error.message}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pilha</CardTitle>
            </CardHeader>
            <CardContent>
              {stack ? (
                <div className="space-y-3">
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                    {[stack.head, ...(stack.appFrames.length > 0 ? stack.appFrames : stack.otherFrames)].filter(Boolean).join("\n")}
                  </pre>
                  {stack.appFrames.length > 0 && stack.otherFrames.length > 0 ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Quadros do framework e do Node ({stack.otherFrames.length})</summary>
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">{stack.otherFrames.join("\n")}</pre>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Este erro foi registrado sem pilha (por exemplo, uma mensagem de log).</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contexto da última vez</CardTitle>
            </CardHeader>
            <CardContent>
              {context.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem contexto registrado.</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {context.map((row) => (
                    <div key={row.key} className="contents">
                      <dt className="text-muted-foreground" title={row.key}>
                        {row.label}
                      </dt>
                      <dd className="min-w-0 break-all font-mono text-xs">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Passos antes do erro</CardTitle>
              <p className="text-xs text-muted-foreground">
                {withCrumbs ? (
                  <>
                    Da ocorrência <span className="select-all font-mono">{withCrumbs.reference ?? "sem código"}</span>. Telas abertas e ações, sem nada do que foi digitado.
                  </>
                ) : (
                  "Telas abertas e ações, sem nada do que foi digitado."
                )}
              </p>
            </CardHeader>
            <CardContent>
              <CrumbList crumbs={parseCrumbs(withCrumbs?.context.breadcrumbs)} empty="Nenhuma ocorrência recente trouxe os passos (só erros de ação com código e erros do navegador enviam)." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas ocorrências</CardTitle>
              <p className="text-xs text-muted-foreground">Até 20. O código é o que a pessoa viu na tela naquela vez.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3 font-normal">Código</th>
                      <th className="pb-2 pr-3 font-normal">Quando</th>
                      <th className="pb-2 pr-3 font-normal">Tela</th>
                      <th className="pb-2 pr-3 font-normal">Perfil</th>
                      <th className="pb-2 pr-3 font-normal">Versão</th>
                      <th className="pb-2 pr-3 font-normal">Pessoa</th>
                      <th className="pb-2 font-normal">Conversa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {error.occurrences.map((occurrence, index) => (
                      <tr key={`${occurrence.reference ?? "sem-codigo"}-${index}`} className="border-t align-top">
                        <td className="py-1.5 pr-3 font-mono text-xs select-all">{occurrence.reference ?? "—"}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                          <RelativeTime date={occurrence.occurredAt} />
                        </td>
                        <td className="py-1.5 pr-3 break-all font-mono text-xs">{String(occurrence.context.route ?? occurrence.context.path ?? "—")}</td>
                        <td className="py-1.5 pr-3 text-xs">{String(occurrence.context.profile ?? "—")}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{String(occurrence.context.release ?? "—")}</td>
                        <td className="py-1.5 pr-3 text-xs">
                          {occurrence.userId ? (
                            <Link href={`/health/users/${encodeURIComponent(occurrence.userId)}`} className="font-mono underline underline-offset-2" title={occurrence.userId}>
                              {occurrence.userId.slice(0, 8)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 text-xs">
                          {occurrence.thread ? (
                            <Link href={`/support/${occurrence.thread.id}`} className="underline underline-offset-2">
                              <ProtocolTag number={occurrence.thread.number} />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p>
                <span className="text-muted-foreground">Vezes: </span>
                {error.count}
              </p>
              <p>
                <span className="text-muted-foreground">Primeira vez: </span>
                <RelativeTime date={error.firstSeen} />
              </p>
              <p>
                <span className="text-muted-foreground">Última vez: </span>
                <RelativeTime date={error.lastSeen} />
              </p>
              <p>
                <span className="text-muted-foreground">Código: </span>
                <span className="select-all font-mono text-xs">{error.lastReference ?? "—"}</span>
              </p>
              <p className="break-words">
                <span className="text-muted-foreground">Espaço: </span>
                {error.organizationId ? (
                  <Link href={`/spaces/${error.organizationId}?tab=saude`} className="underline underline-offset-2">
                    {error.organizationName}
                  </Link>
                ) : (
                  "sem espaço"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversas com este código</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {error.threads.length === 0 ? (
                <p className="text-muted-foreground">Ninguém relatou este erro ainda.</p>
              ) : (
                error.threads.map((thread) => (
                  <p key={thread.id} className="break-words">
                    <ProtocolTag number={thread.number} className="mr-2" />
                    <Link href={`/support/${thread.id}`} className="underline underline-offset-2">
                      {thread.subject}
                    </Link>
                    <span className="text-muted-foreground"> · {STATUS_LABEL[thread.status] ?? thread.status}</span>
                    {thread.bugStatus ? (
                      <>
                        {" "}
                        <BugStatusBadge status={thread.bugStatus} />
                      </>
                    ) : null}
                  </p>
                ))
              )}
            </CardContent>
          </Card>

          {can(admin.role, "health:view") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ação</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={error.known ? unmarkKnownAction : markKnownAction}>
                  <input type="hidden" name="fingerprint" value={error.fingerprint} />
                  <Button type="submit" variant="outline" className="w-full">
                    {error.known ? "Desmarcar conhecido" : "Marcar conhecido"}
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
