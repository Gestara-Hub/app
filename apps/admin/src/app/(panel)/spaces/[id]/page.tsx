import { RelativeDay, RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, CreditCard, Landmark, MessageSquare, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { CopyCode } from "@/components/shared/copy-code";
import { EmptyState } from "@/components/shared/empty-state";
import { Fact, FactCard, SectionHeading } from "@/components/shared/fact-list";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { PlanBadge } from "@/components/shared/plan-badge";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { TabLinks } from "@/components/shared/tab-links";
import { ProtocolTag, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { listErrors, listWebhooks } from "@/lib/server/health";
import { getSpace, listPlanEvents, listSpaceNotes } from "@/lib/server/spaces";
import { listThreads } from "@/lib/server/support";
import { sql } from "@/lib/server/db";
import { brasiliaDay } from "@/lib/sla";
import { AREA_LABEL, MODEL_LABEL, TIER_LABEL, planName, planSituation } from "@/lib/space-plan";
import { CourtesyForm, ForceFreeForm, GraceForm, RevokeCourtesyForm } from "./plan-forms";
import { DataTab } from "./data-tab";
import { AccessForm } from "../../support-view/access-form";
import { listGrants } from "@/lib/server/plans";
import { NoteForm } from "./note-form";
import { NoteActions } from "./note-actions";

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
      <BackLink href="/spaces" label="Voltar aos espaços" />
      <PageHeader title={space.name} description={`${space.customAreaName || AREA_LABEL[space.area ?? ""] || "Sem área"} · ${MODEL_LABEL[space.model] ?? space.model}`}>
        <PlanBadge subscription={space.subscription} today={today} />
        {space.status === "inactive" ? <Badge variant="destructive">Inativo</Badge> : null}
      </PageHeader>
      <div className="-mt-4 mb-5">
        <CopyCode value={space.id} label="Código" />
      </div>
      <TabLinks tabs={TABS} active={tab} href={href} />

      {tab === "resumo" ? <Summary space={space} /> : null}
      {tab === "assinatura" ? <Subscription space={space} today={today} canGrant={can(admin.role, "plans:grant")} /> : null}
      {tab === "saude" ? <Health spaceId={space.id} page={page} href={(p) => `${href("saude")}&page=${p}`} /> : null}
      {tab === "recebimentos" ? <Online space={space} /> : null}
      {tab === "suporte" ? <SupportTab spaceId={space.id} canAnnotate={can(admin.role, "spaces:annotate")} canAccess={can(admin.role, "support:access")} /> : null}
      {tab === "auditoria" && can(admin.role, "audit:view") ? <PanelAudit spaceId={space.id} /> : null}
      {tab === "dados" && can(admin.role, "lgpd:manage") ? <DataTab space={space} /> : null}
      {tab === "dados" && !can(admin.role, "lgpd:manage") ? <EmptyState title="Só o proprietário vê dados e LGPD" /> : null}
      {tab === "auditoria" && !can(admin.role, "audit:view") ? <EmptyState title="Seu papel não vê a auditoria do painel" /> : null}
    </>
  );
}

type Space = NonNullable<Awaited<ReturnType<typeof getSpace>>>;

function Summary({ space }: { space: Space }) {
  const timeZone = (space.settings as { timeZone?: string } | null)?.timeZone;
  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard label="Alunos ativos" value={space.studentsActive} sub={`de ${space.studentsTotal} no total`} />
        <StatCard label="Turmas ativas" value={space.classesActive} sub={`${space.teachersActive} ${space.teachersActive === 1 ? "professor ativo" : "professores ativos"}`} />
        <StatCard label="Pessoas com acesso" value={space.usersActive} />
        <StatCard label="Cobranças em aberto" value={space.chargesOpen} sub={brl(space.chargesOpenCents)} tone={space.chargesOpen > 0 ? "warning" : "default"} />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <FactCard title="Quem é" description="Contato do dono, para falar com o cliente. Nenhum dado de aluno.">
          <Fact label="Dono" value={space.ownerName ?? "Sem dono ativo"} />
          <Fact label="E-mail do dono" value={space.ownerEmail ?? "—"} />
          <Fact label="Criado" value={<RelativeTime date={space.createdAt} />} />
          <Fact label="Fuso" value={timeZone ?? "Padrão (Brasília)"} />
          <Fact label="Termos de uso" value={space.termsAcceptedAt ? <>{space.termsVersion ?? ""} · aceitos <RelativeTime date={space.termsAcceptedAt} /></> : "Ainda não aceitos"} />
        </FactCard>
        <FactCard title="Atividade">
          <Fact label="Último acesso de alguém" value={<RelativeTime date={space.lastSignInAt} empty="Nunca" />} />
          <Fact label="Última chamada" value={<RelativeTime date={space.lastAttendanceAt} empty="Nunca" />} />
        </FactCard>
      </div>
    </div>
  );
}

async function Subscription({ space, today, canGrant }: { space: Space; today: string; canGrant: boolean }) {
  const [events, grants] = await Promise.all([listPlanEvents(space.id), listGrants({ organizationId: space.id, limit: 20 })]);
  const situation = planSituation(space.subscription, today);
  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard label="Plano" value={planName(space.subscription)} />
        <StatCard label="Situação" value={situation.label} sub={situation.detail} />
        <StatCard label="Valor" value={space.subscription?.priceCents ? brl(space.subscription.priceCents) : "—"} />
        <StatCard label="Assinatura no parceiro" value={space.subscription?.asaasSubscriptionId ? "Sim" : "Não"} />
      </StatGrid>

      {canGrant ? (
        <section>
          <SectionHeading title="Ações do plano" description="Cada ação pede o motivo e uma confirmação." />
          <ListContainer>
            {situation.key === "courtesy" ? <RevokeCourtesyForm spaceId={space.id} /> : null}
            {situation.key === "free" || situation.key === "reverted" || situation.key === "courtesy" ? <CourtesyForm spaceId={space.id} /> : null}
            {situation.key === "grace" || situation.key === "overdue" ? <GraceForm spaceId={space.id} /> : null}
            {situation.key !== "free" && situation.key !== "reverted" ? (
              <ForceFreeForm spaceId={space.id} needsPartnerCheck={Boolean(space.subscription?.asaasSubscriptionId) && situation.key !== "courtesy"} />
            ) : null}
          </ListContainer>
        </section>
      ) : null}

      {grants.length > 0 ? (
        <section>
          <SectionHeading title="Concessões do painel" />
          <ListContainer>
            {grants.map((grant) => (
              <ListRow key={grant.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="min-w-0 break-words font-medium">
                      {GRANT_LABEL[grant.kind]}
                      {grant.endsOn ? <> · termina <RelativeDay day={grant.endsOn} /></> : null}
                      {grant.revokedAt ? <span className="font-normal text-muted-foreground"> (encerrada)</span> : null}
                    </p>
                    <p className="min-w-0 break-words text-sm text-muted-foreground">{grant.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {grant.grantedByName} · <RelativeTime date={grant.createdAt} />
                  </span>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      ) : null}

      <section>
        <SectionHeading title="Histórico do plano" />
        <ListSummaryBar count={events.length} singularLabel="evento" pluralLabel="eventos" />
        <ListContainer emptyState={events.length === 0 ? <EmptyState icon={CreditCard} title="Nenhum evento do plano" /> : undefined} className="mt-2">
          {events.map((e) => (
            <ListRow key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="min-w-0 break-words font-medium">{KIND_LABEL[e.kind] ?? e.kind}</p>
                  <p className="min-w-0 break-words text-sm text-muted-foreground">
                    {TIER_LABEL[e.tierBefore ?? "free"] ?? e.tierBefore} → {TIER_LABEL[e.tierAfter ?? "free"] ?? e.tierAfter}
                    {e.amountCents ? ` · ${brl(e.amountCents)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.actorName ?? (e.source ? `Sistema (${e.source})` : "—")} · <RelativeTime date={e.createdAt} />
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </div>
  );
}

async function Health({ spaceId, page, href }: { spaceId: string; page: number; href: (page: number) => string }) {
  const [errors, hooks] = await Promise.all([
    listErrors({ period: "30d", organizationId: spaceId, page }),
    listWebhooks({ organizationId: spaceId, page: 1 }),
  ]);
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Erros dos últimos 30 dias" description="Agrupados e sem dado pessoal. O código é o que o cliente vê na mensagem de erro." />
        <ListSummaryBar count={errors.rows.length} singularLabel="erro" pluralLabel="erros" />
        <ListContainer emptyState={errors.rows.length === 0 ? <EmptyState icon={Activity} title="Nenhum erro neste período" /> : undefined} className="mt-2">
          {errors.rows.map((e) => (
            <ListRow key={e.id} className="relative">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0 space-y-0.5">
                  <Link href={`/health/errors/${e.id}`} className="min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                    {e.message}
                  </Link>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{e.event}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {e.count} {e.count === 1 ? "vez" : "vezes"}
                  </Badge>
                  <span><RelativeTime date={e.lastSeen} /></span>
                  {e.lastReference ? <code className="break-all font-mono text-[11px]">{e.lastReference}</code> : null}
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
        <Pager page={page} hasNext={errors.hasNext} href={href} />
      </section>
      <section>
        <SectionHeading title="Avisos do parceiro de pagamentos" />
        <ListContainer emptyState={hooks.rows.length === 0 ? <EmptyState icon={Landmark} title="Nenhum aviso recebido" /> : undefined}>
          {hooks.rows.map((w) => (
            <ListRow key={w.id}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0 space-y-0.5">
                  <p className="break-all font-mono text-xs">{w.event}</p>
                  {w.outcome ? <p className="min-w-0 break-words text-sm text-muted-foreground">{w.outcome}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {w.status}
                  </Badge>
                  <span><RelativeTime date={w.receivedAt} /></span>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </div>
  );
}

const GATEWAY_LABEL: Record<string, string> = { not_configured: "Não configurado", pending: "Em análise no parceiro", approved: "Aprovado", rejected: "Recusado" };

function Online({ space }: { space: Space }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Últimos 30 dias. Só contagem e valor, sem nome de aluno.</p>
      <StatGrid>
        <StatCard label="Pagamentos recebidos" value={space.online.paidCount} sub={brl(space.online.paidCents)} tone={space.online.paidCount > 0 ? "success" : "default"} />
        <StatCard label="Aguardando o aluno" value={space.online.awaitingCount} />
        <StatCard label="Vencidos ou cancelados" value={space.online.lostCount} tone={space.online.lostCount > 0 ? "warning" : "default"} />
        <StatCard label="Taxa do GestaraHub" value={brl(space.online.platformFeeCents)} />
      </StatGrid>
      <FactCard title="Conta de recebimento">
        <Fact label="Situação" value={GATEWAY_LABEL[space.gatewayStatus ?? "not_configured"] ?? space.gatewayStatus} />
        <Fact label="Parceiro" value={space.gatewayProvider ?? "—"} />
        <Fact label="Tarifas sincronizadas" value={<RelativeTime date={space.gatewayFeesSyncedAt} empty="Nunca" />} />
      </FactCard>
    </div>
  );
}

async function SupportTab({ spaceId, canAnnotate, canAccess }: { spaceId: string; canAnnotate: boolean; canAccess: boolean }) {
  const [{ rows }, notes] = await Promise.all([listThreads({ filter: "all", organizationId: spaceId, page: 1 }), listSpaceNotes(spaceId)]);
  const mine = rows;
  return (
    <div className="space-y-6">
      {canAccess ? <AccessForm spaceId={spaceId} /> : null}
      <section>
        <SectionHeading title="Conversas do suporte" />
        <ListSummaryBar count={mine.length} singularLabel="conversa" pluralLabel="conversas" />
        <ListContainer emptyState={mine.length === 0 ? <EmptyState icon={MessageSquare} title="Nenhuma conversa deste espaço" /> : undefined} className="mt-2">
          {mine.map((thread) => (
            <ListRow key={thread.id} className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/support/${thread.id}`} className="min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                  <ProtocolTag number={thread.number} className="mr-2 align-middle" />
                  {thread.subject}
                </Link>
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={thread.status} />
                  {thread.urgent ? <UrgentBadge /> : null}
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
      <section>
        <SectionHeading title="Anotações internas" description="Só a equipe vê. O cliente nunca vê.">
          {canAnnotate ? <NoteForm spaceId={spaceId} /> : null}
        </SectionHeading>
        <ListContainer emptyState={notes.length === 0 ? <EmptyState icon={ScrollText} title="Nenhuma anotação ainda" /> : undefined}>
          {notes.map((note) => (
            <ListRow key={note.id} actions={canAnnotate ? <NoteActions id={note.id} spaceId={spaceId} pinned={note.pinned} /> : undefined}>
              <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {note.pinned ? (
                  <Badge variant="secondary" className="font-normal">
                    Fixada
                  </Badge>
                ) : null}
                <span>
                  {note.adminName ?? "—"} · <RelativeTime date={note.createdAt} />
                </span>
              </p>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </div>
  );
}

async function PanelAudit({ spaceId }: { spaceId: string }) {
  const rows = await sql()<{ id: string; action: string; admin_name: string | null; reason: string | null; created_at: Date }[]>`
    select id, action, admin_name, reason, created_at from platform.audit_logs where organization_id = ${spaceId} order by created_at desc limit 50`;
  const { auditActionLabel } = await import("@/lib/audit-labels");
  return (
    <div className="space-y-2">
      <ListSummaryBar count={rows.length} singularLabel="registro" pluralLabel="registros" />
      <ListContainer emptyState={rows.length === 0 ? <EmptyState icon={ScrollText} title="O painel ainda não fez nada neste espaço" /> : undefined}>
        {rows.map((row) => (
          <ListRow key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="min-w-0 break-words font-medium">{auditActionLabel(row.action)}</p>
                {row.reason ? <p className="min-w-0 break-words text-sm text-muted-foreground">{row.reason}</p> : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {row.admin_name ?? "—"} · <RelativeTime date={row.created_at} />
              </span>
            </div>
          </ListRow>
        ))}
      </ListContainer>
    </div>
  );
}
