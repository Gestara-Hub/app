import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { RelativeTime } from "@/components/shared/relative-time";
import { BackLink } from "@/components/shared/back-link";
import { TimelineList } from "@/components/health/timeline-list";
import { KindBadge, ProtocolTag, StatusBadge } from "@/components/support/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { userTimeline } from "@/lib/server/activity";
import { requireAdmin } from "@/lib/server/context";
import { listUserOccurrences } from "@/lib/server/health";
import { listUserThreads } from "@/lib/server/support";

export const metadata: Metadata = { title: "Linha do tempo da pessoa" };

const PERIODS = [7, 30] as const;

/**
 * Tudo o que o painel sabe de uma pessoa do sistema: a linha do tempo (erros,
 * ações auditadas e conversas, só com tipo e hora, sem nome de aluno) e as
 * conversas de suporte. Nome e e-mail só vêm das conversas dela; sem conversa,
 * só o id interno.
 */
export default async function UserTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  await requireAdmin("health:view");
  const { userId: raw } = await params;
  const userId = decodeURIComponent(raw);
  if (!/^[\w-]{1,64}$/.test(userId)) notFound();
  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? PERIODS[0];
  const [recentErrors, threads] = await Promise.all([listUserOccurrences({ userId, days: 30, limit: 1 }), listUserThreads(userId)]);
  if (recentErrors.length === 0 && threads.length === 0) notFound();
  const who = threads[0];
  const organization = who
    ? { id: who.organizationId, name: who.organizationName }
    : recentErrors[0]?.organizationId
      ? { id: recentErrors[0].organizationId, name: recentErrors[0].organizationName ?? "" }
      : null;
  const timeline = await userTimeline({ userId, organizationId: organization?.id ?? null, days, limit: 100 });

  return (
    <>
      <BackLink href="/health" />
      <PageHeader
        title={who ? who.userName : "Pessoa do sistema"}
        description={[who?.userEmail, organization?.name].filter(Boolean).join(" · ") || `Id ${userId}`}
      />
      <p className="-mt-3 mb-6 break-all font-mono text-xs text-muted-foreground">
        {userId}
        {organization ? (
          <>
            {" · "}
            <Link href={`/spaces/${organization.id}`} className="underline underline-offset-2">
              ver o espaço
            </Link>
          </>
        ) : null}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Linha do tempo dos últimos {days} dias</CardTitle>
            <div className="flex gap-1.5" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <Button key={p} asChild size="sm" variant={p === days ? "secondary" : "ghost"}>
                  <Link href={`/health/users/${encodeURIComponent(userId)}?dias=${p}`}>{p} dias</Link>
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <TimelineList items={timeline} empty="Nada registrado desta pessoa no período." />
            <p className="mt-4 text-xs text-muted-foreground">
              As ações vêm da Auditoria do espaço e mostram só o tipo e a hora. Navegação e cliques sem registro não aparecem.
            </p>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Conversas de suporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {threads.length === 0 ? (
              <p className="text-muted-foreground">Esta pessoa nunca abriu uma conversa.</p>
            ) : (
              threads.map((thread) => (
                <div key={thread.id} className="space-y-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <ProtocolTag number={thread.number} />
                    <KindBadge kind={thread.kind} />
                    <StatusBadge status={thread.status} />
                  </p>
                  <Link href={`/support/${thread.id}`} className="block break-words underline underline-offset-2">
                    {thread.subject}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <RelativeTime date={thread.createdAt} />
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
