import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtocolTag } from "@/components/support/badges";
import { can } from "@/lib/permissions";
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
  const contextEntries = Object.entries(error.context);

  return (
    <>
      <BackLink href={error.organizationId ? `/spaces/${error.organizationId}?tab=saude` : "/health"} />
      <PageHeader title="Detalhe do erro" description={error.message}>
        <Badge variant="secondary" className="font-normal">
          {SOURCE_LABEL[error.source] ?? error.source}
        </Badge>
        {error.level === "warn" ? (
          <Badge variant="outline" className="font-normal">
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
              {error.stack ? (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">{error.stack}</pre>
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
              {contextEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem contexto registrado.</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {contextEntries.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="break-all font-mono text-xs text-muted-foreground">{key}</dt>
                      <dd className="min-w-0 break-all font-mono text-xs">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
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
