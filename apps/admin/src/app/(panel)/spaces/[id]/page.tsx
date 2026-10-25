import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/shared/pager";
import { PlanBadge } from "@/components/shared/plan-badge";
import { TabLinks } from "@/components/shared/tab-links";
import { StatusBadge, UrgentBadge } from "@/components/support/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ago, brDay, brl, dateOnly, dateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { listErrors, listWebhooks } from "@/lib/server/health";
import { getSpace, listPlanEvents, listSpaceNotes } from "@/lib/server/spaces";
import { listThreads } from "@/lib/server/support";
import { sql } from "@/lib/server/db";
import { brasiliaDay } from "@/lib/sla";
import { AREA_LABEL, MODEL_LABEL, TIER_LABEL, planName, planSituation } from "@/lib/space-plan";
import { deleteNoteAction, pinNoteAction } from "./actions";
import { CourtesyForm, ForceFreeForm, GraceForm, RevokeCourtesyForm } from "./plan-forms";
import { DataTab } from "./data-tab";
import { AccessForm } from "../../support-view/access-form";
import { listGrants } from "@/lib/server/plans";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Espaço" };

const GRANT_LABEL = { courtesy: "Cortesia", grace: "Mais dias para pagar", forced_free: "Voltou ao Grátis" } as const;

const TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "assinatura", label: "Assinatura" },
  { value: "saude", label: "Saúde" },
  { value: "recebimentos", label: "Recebimentos online" },
  { value: "suporte", label: "Suporte e notas" },
  { value: "auditoria", label: "Auditoria do painel" },
  { value: "dados", label: "Dados e LGPD" },
];

const KIND_LABEL: Record<string, string> = {
  activated: "Assinou",
  upgraded: "Subiu de plano",
  downgraded: "Reduziu o plano",
  canceled: "Cancelou",
  change_scheduled: "Troca marcada",
  change_unscheduled: "Troca desmarcada",
  change_applied: "Troca aplicada",
  renewed: "Renovou",
  reverted_to_free: "Voltou ao Grátis",
  removed_at_partner: "Assinatura removida no parceiro",
  reactivated: "Religou o plano",
  courtesy_granted: "Cortesia concedida",
  courtesy_ended: "Cortesia terminou",
  courtesy_revoked: "Cortesia encerrada",
  grace_extended: "Mais dias para pagar",
  forced_free: "Voltou ao Grátis pelo painel",
};

export default async function SpacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { admin } = await requireAdmin("spaces:view");
  const { id } = await params;
  const search = await searchParams;
  const space = await getSpace(id);
  if (!space) notFound();
  const tab = TABS.some((t) => t.value === search.tab) ? (search.tab as string) : "resumo";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const today = brasiliaDay(new Date());
  const href = (next: string) => `/spaces/${space.id}?tab=${next}`;

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-2">
        <Link href="/spaces">
          <ArrowLeft className="size-4" /> Voltar aos espaços
        </Link>
      </Button>
      <PageHeader title={space.name} description={`${space.customAreaName || AREA_LABEL[space.area ?? ""] || "Sem área"} · ${MODEL_LABEL[space.model] ?? space.model} · código ${space.id}`}>
        <PlanBadge subscription={space.subscription} today={today} />
        {space.status === "inactive" ? <Badge variant="destructive">Inativo</Badge> : null}
      </PageHeader>
      <TabLinks tabs={TABS} active={tab} href={href} />

      {tab === "resumo" ? <Summary space={space} /> : null}
      {tab === "assinatura" ? <Subscription space={space} today={today} canGrant={can(admin.role, "plans:grant")} /> : null}
      {tab === "saude" ? <Health spaceId={space.id} page={page} href={(p) => `${href("saude")}&page=${p}`} /> : null}
      {tab === "recebimentos" ? <Online space={space} /> : null}
      {tab === "suporte" ? <SupportTab spaceId={space.id} canAnnotate={can(admin.role, "spaces:annotate")} canAccess={can(admin.role, "support:access")} /> : null}
      {tab === "auditoria" && can(admin.role, "audit:view") ? <PanelAudit spaceId={space.id} /> : null}
      {tab === "dados" && can(admin.role, "lgpd:manage") ? <DataTab space={space} /> : null}
      {tab === "dados" && !can(admin.role, "lgpd:manage") ? <p className="text-sm text-muted-foreground">Só o proprietário vê dados e LGPD.</p> : null}
      {tab === "auditoria" && !can(admin.role, "audit:view") ? <p className="text-sm text-muted-foreground">Seu papel não vê a auditoria do painel.</p> : null}
    </>
  );
}

type Space = NonNullable<Awaited<ReturnType<typeof getSpace>>>;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}

function Summary({ space }: { space: Space }) {
  const timeZone = (space.settings as { timeZone?: string } | null)?.timeZone;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quem é</CardTitle>
          <CardDescription>Contato do dono, para falar com o cliente. Nenhum dado de aluno.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Fact label="Dono" value={space.ownerName ?? "Sem dono ativo"} />
            <Fact label="E-mail do dono" value={space.ownerEmail ?? "—"} />
            <Fact label="Criado em" value={dateOnly(space.createdAt)} />
            <Fact label="Último acesso de alguém" value={ago(space.lastSignInAt)} />
            <Fact label="Fuso" value={timeZone ?? "Padrão (Brasília)"} />
            <Fact
              label="Termos de uso"
              value={space.termsAcceptedAt ? `${space.termsVersion ?? ""} · aceitos em ${dateOnly(space.termsAcceptedAt)}` : "Ainda não aceitos"}
            />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Fact label="Alunos ativos" value={`${space.studentsActive} de ${space.studentsTotal}`} />
            <Fact label="Turmas ativas" value={space.classesActive} />
            <Fact label={`Instrutores e professores ativos`} value={space.teachersActive} />
            <Fact label="Pessoas com acesso" value={space.usersActive} />
            <Fact label="Cobranças em aberto" value={`${space.chargesOpen} · ${brl(space.chargesOpenCents)}`} />
            <Fact label="Última chamada" value={ago(space.lastAttendanceAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

async function Subscription({ space, today, canGrant }: { space: Space; today: string; canGrant: boolean }) {
  const [events, grants] = await Promise.all([listPlanEvents(space.id), listGrants({ organizationId: space.id, limit: 20 })]);
  const situation = planSituation(space.subscription, today);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Fact label="Plano" value={planName(space.subscription)} />
            <Fact label="Situação" value={situation.label} />
            {situation.detail ? <Fact label="Detalhe" value={situation.detail} /> : null}
            <Fact label="Valor" value={space.subscription?.priceCents ? brl(space.subscription.priceCents) : "—"} />
            <Fact label="Assinatura no parceiro" value={space.subscription?.asaasSubscriptionId ? "Sim" : "Não"} />
          </dl>
        </CardContent>
      </Card>
      {canGrant ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {situation.key === "courtesy" ? <RevokeCourtesyForm spaceId={space.id} /> : null}
          {situation.key === "free" || situation.key === "reverted" || situation.key === "courtesy" ? <CourtesyForm spaceId={space.id} /> : null}
          {situation.key === "grace" || situation.key === "overdue" ? <GraceForm spaceId={space.id} /> : null}
          {situation.key !== "free" && situation.key !== "reverted" ? (
            <ForceFreeForm spaceId={space.id} needsPartnerCheck={Boolean(space.subscription?.asaasSubscriptionId) && situation.key !== "courtesy"} />
          ) : null}
        </div>
      ) : null}
      {grants.length > 0 ? (
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Concessões do painel</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ul className="divide-y text-sm">
              {grants.map((grant) => (
                <li key={grant.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">
                    {GRANT_LABEL[grant.kind]}
                    {grant.endsOn ? ` até ${brDay(grant.endsOn)}` : ""}
                    {grant.revokedAt ? " (encerrada)" : ""} · <span className="text-muted-foreground">{grant.reason}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {grant.grantedByName} · {dateTime(grant.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Histórico do plano</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>O quê</TableHead>
              <TableHead>De → para</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Quem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum evento do plano.
                </TableCell>
              </TableRow>
            ) : (
              events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(e.createdAt)}</TableCell>
                  <TableCell>{KIND_LABEL[e.kind] ?? e.kind}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {TIER_LABEL[e.tierBefore ?? "free"] ?? e.tierBefore} → {TIER_LABEL[e.tierAfter ?? "free"] ?? e.tierAfter}
                  </TableCell>
                  <TableCell>{e.amountCents ? brl(e.amountCents) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.actorName ?? (e.source ? `Sistema (${e.source})` : "—")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

async function Health({ spaceId, page, href }: { spaceId: string; page: number; href: (page: number) => string }) {
  const [errors, hooks] = await Promise.all([
    listErrors({ period: "30d", organizationId: spaceId, page }),
    listWebhooks({ organizationId: spaceId, page: 1 }),
  ]);
  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Erros dos últimos 30 dias</CardTitle>
          <CardDescription>Agrupados e sem dado pessoal. O código é o que o cliente vê na mensagem de erro.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Onde</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="text-right">Vezes</TableHead>
              <TableHead>Último</TableHead>
              <TableHead>Código</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum erro neste período.
                </TableCell>
              </TableRow>
            ) : (
              errors.rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs break-all">
                    <Link href={`/health/errors/${e.id}`} className="hover:underline">
                      {e.event}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80 break-words">
                    <Link href={`/health/errors/${e.id}`} className="hover:underline">
                      {e.message}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.count}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{ago(e.lastSeen)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.lastReference ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={page} hasNext={errors.hasNext} href={href} />
      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Avisos do parceiro de pagamentos</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hooks.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhum aviso recebido.
                </TableCell>
              </TableRow>
            ) : (
              hooks.rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(w.receivedAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{w.event}</TableCell>
                  <TableCell>{w.status}</TableCell>
                  <TableCell className="break-words text-muted-foreground">{w.outcome ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const GATEWAY_LABEL: Record<string, string> = { not_configured: "Não configurado", pending: "Em análise no parceiro", approved: "Aprovado", rejected: "Recusado" };

function Online({ space }: { space: Space }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta de recebimento</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Fact label="Situação" value={GATEWAY_LABEL[space.gatewayStatus ?? "not_configured"] ?? space.gatewayStatus} />
            <Fact label="Parceiro" value={space.gatewayProvider ?? "—"} />
            <Fact label="Tarifas sincronizadas" value={ago(space.gatewayFeesSyncedAt)} />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 30 dias</CardTitle>
          <CardDescription>Só contagem e valor, sem nome de aluno.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Fact label="Pagamentos recebidos" value={`${space.online.paidCount} · ${brl(space.online.paidCents)}`} />
            <Fact label="Aguardando o aluno" value={space.online.awaitingCount} />
            <Fact label="Vencidos ou cancelados" value={space.online.lostCount} />
            <Fact label="Taxa do GestaraHub" value={brl(space.online.platformFeeCents)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

async function SupportTab({ spaceId, canAnnotate, canAccess }: { spaceId: string; canAnnotate: boolean; canAccess: boolean }) {
  const [{ rows }, notes] = await Promise.all([listThreads({ filter: "all", q: spaceId, page: 1 }), listSpaceNotes(spaceId)]);
  const mine = rows.filter((r) => r.organizationId === spaceId);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canAccess ? (
        <div className="lg:col-span-2">
          <AccessForm spaceId={spaceId} />
        </div>
      ) : null}
      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Conversas do suporte</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa deste espaço.</p>
          ) : (
            <ul className="divide-y">
              {mine.map((thread) => (
                <li key={thread.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/support/${thread.id}`} className="min-w-0 break-words font-medium hover:underline">
                    {thread.subject}
                  </Link>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={thread.status} />
                    {thread.urgent ? <UrgentBadge /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anotações internas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canAnnotate ? <NoteForm spaceId={spaceId} /> : null}
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border p-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{note.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {note.adminName ?? "—"} · {dateTime(note.createdAt)}
                    {note.pinned ? " · fixada" : ""}
                  </span>
                  <span className={canAnnotate ? "flex gap-1" : "hidden"}>
                    <form action={pinNoteAction}>
                      <input type="hidden" name="id" value={note.id} />
                      <input type="hidden" name="spaceId" value={spaceId} />
                      <input type="hidden" name="pinned" value={note.pinned ? "0" : "1"} />
                      <Button type="submit" variant="ghost" size="xs">
                        {note.pinned ? "Desafixar" : "Fixar"}
                      </Button>
                    </form>
                    <form action={deleteNoteAction}>
                      <input type="hidden" name="id" value={note.id} />
                      <Button type="submit" variant="ghost" size="xs" className="text-destructive">
                        Excluir
                      </Button>
                    </form>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

async function PanelAudit({ spaceId }: { spaceId: string }) {
  const rows = await sql()<{ id: string; action: string; admin_name: string | null; reason: string | null; created_at: Date }[]>`
    select id, action, admin_name, reason, created_at from platform.audit_logs where organization_id = ${spaceId} order by created_at desc limit 50`;
  const { auditActionLabel } = await import("@/lib/audit-labels");
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Quem</TableHead>
            <TableHead>O que</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                O painel ainda não fez nada neste espaço.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(row.created_at)}</TableCell>
                <TableCell>{row.admin_name ?? "—"}</TableCell>
                <TableCell>{auditActionLabel(row.action)}</TableCell>
                <TableCell className="break-words text-muted-foreground">{row.reason ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
