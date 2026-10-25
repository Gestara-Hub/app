import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { TabLinks } from "@/components/shared/tab-links";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeSearch, pickOption } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { requireAdmin } from "@/lib/server/context";
import {
  PERIODS,
  errorTotals,
  findErrorByReference,
  gatewayOverview,
  isPeriod,
  lastRunPerJob,
  listErrors,
  JOB_RUN_STATUSES,
  listJobRunsPage,
  listWebhooks,
  webhookStats,
  type Period,
} from "@/lib/server/health";
import { ErrorRowMenu } from "./known-menu";

export const metadata: Metadata = { title: "Saúde" };

const TABS = [
  { value: "erros", label: "Erros" },
  { value: "rotinas", label: "Rotinas" },
  { value: "avisos", label: "Avisos do parceiro" },
  { value: "integracoes", label: "Integrações" },
];

const JOB_LABEL: Record<string, string> = { "cron.daily": "Rotina diária (mensalidades, repetidos, plano)", "cron.online-payments": "Conferência dos pagamentos online" };
const JOB_STATUS_LABEL: Record<string, string> = { running: "Rodando", ok: "Tudo certo", partial: "Terminou com falhas", failed: "Falhou" };
const SOURCE_LABEL: Record<string, string> = { server: "Servidor", browser: "Navegador", cron: "Rotina", webhook: "Aviso do parceiro" };
const GATEWAY_LABEL: Record<string, string> = { not_configured: "Sem conta de recebimento", pending: "Em análise no parceiro", approved: "Aprovada", rejected: "Recusada" };
const WEBHOOK_STATUS_LABEL: Record<string, string> = { received: "Recebido", processed: "Processado", ignored: "Ignorado", failed: "Falhou" };

/** Código ou identificador técnico: fonte mono pequena, quebrando em qualquer ponto. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONO = "break-all font-mono text-xs";

export default async function HealthPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("health:view");
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? (params.tab as string) : "erros";
  const page = parsePage(params.page);
  const query = (override: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...override })) if (value) usp.set(key, value);
    return usp.toString();
  };

  return (
    <>
      <PageHeader title="Saúde do sistema" description="Erros, rotinas e avisos do parceiro de pagamentos. Sem dado pessoal." />
      <TabLinks tabs={TABS} active={tab} href={(next) => `/health?tab=${next}`} />
      {tab === "erros" ? <Errors params={params} page={page} query={query} /> : null}
      {tab === "rotinas" ? <Jobs params={params} page={page} query={query} /> : null}
      {tab === "avisos" ? <Webhooks params={params} page={page} query={query} /> : null}
      {tab === "integracoes" ? <Integrations /> : null}
    </>
  );
}

async function Errors({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const period: Period = isPeriod(params.period) ? params.period : "24h";
  const q = normalizeSearch(params.q);
  const source = pickOption(params.source, Object.keys(SOURCE_LABEL));
  const level = pickOption(params.level, ["error", "warn"] as const);
  const space = params.space && UUID.test(params.space) ? params.space : undefined;
  const hideKnown = params.known === "hide";
  const [totals, list, byCode] = await Promise.all([
    errorTotals(),
    listErrors({ period, source, level, organizationId: space, q, hideKnown, page }),
    q && /^[A-Za-z0-9]{6,10}$/.test(q) ? findErrorByReference(q) : Promise.resolve(null),
  ]);
  const info = pageInfo(list.page, list.total);
  const hasFilters = Boolean(q || isPeriod(params.period) || source || level || space || hideKnown);
  return (
    <div className="space-y-4">
      <StatGrid className="mb-0">
        <StatCard label="Erros nas últimas 24 h" value={totals.today} tone={totals.today > 0 ? "warning" : "default"} />
        <StatCard label="Espaços afetados" value={totals.spacesAffected} />
        <StatCard label="Ainda não conhecidos" value={totals.unknown} tone={totals.unknown > 0 ? "danger" : "default"} />
      </StatGrid>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UrlSearch placeholder="Código, local, mensagem ou espaço" ariaLabel="Buscar erros" />
        <UrlSelect
          param="period"
          ariaLabel="Período"
          allLabel={`Últimas ${PERIODS["24h"]}`}
          options={[
            ["7d", `Últimos ${PERIODS["7d"]}`],
            ["30d", `Últimos ${PERIODS["30d"]}`],
          ]}
        />
        <UrlSelect param="source" ariaLabel="Origem" allLabel="Todas as origens" options={Object.entries(SOURCE_LABEL)} />
        <UrlSelect
          param="level"
          ariaLabel="Nível"
          allLabel="Erros e avisos"
          options={[
            ["error", "Só erros"],
            ["warn", "Só avisos"],
          ]}
        />
        <UrlSelect param="known" ariaLabel="Conhecidos" allLabel="Com os conhecidos" options={[["hide", "Esconder os conhecidos"]]} className="sm:w-52" />
        <UrlClearFilters params={["q", "period", "source", "level", "known", "space"]} />
      </div>
      {space ? (
        <p className="px-1 text-xs text-muted-foreground">
          Só os erros de um espaço.{" "}
          <Link href={`/health?${query({ space: undefined, page: undefined })}`} className="underline underline-offset-2">
            Ver de todos os espaços
          </Link>
        </p>
      ) : null}

      {byCode ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">
              Código <span className="font-mono">{byCode.lastReference}</span>
            </CardTitle>
            <CardDescription>
              {byCode.organizationId ? (
                <>
                  Espaço:{" "}
                  <Link href={`/spaces/${byCode.organizationId}?tab=saude`} className="underline underline-offset-2">
                    {byCode.organizationName}
                  </Link>
                </>
              ) : (
                "Sem espaço (rotina geral, página pública ou antes do login)."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className={MONO}>{byCode.event}</p>
            <p className="break-words">{byCode.message}</p>
            <p className="text-muted-foreground">
              {byCode.count} vez{byCode.count > 1 ? "es" : ""} · último <RelativeTime date={byCode.lastSeen} />
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "erro", "erros")}</p>
        <ListContainer
          emptyState={
            list.rows.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title={hasFilters ? "Nenhum erro com esses filtros." : `Nenhum erro nas últimas ${PERIODS[period]}.`}
                description={hasFilters ? "Tente outro período ou limpe os filtros." : undefined}
              >
                <UrlClearFilters params={["q", "period", "source", "level", "known", "space"]} />
              </EmptyState>
            ) : undefined
          }
        >
          {list.rows.map((row) => (
            <ListRow key={row.id} className={row.known ? "relative opacity-60" : "relative"} actions={<ErrorRowMenu id={row.id} fingerprint={row.fingerprint} known={row.known} event={row.event} />}>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/health/errors/${row.id}`} className={`${MONO} after:absolute after:inset-0 hover:underline`}>
                    {row.event}
                  </Link>
                  <Badge variant="secondary" className="font-normal">
                    {SOURCE_LABEL[row.source] ?? row.source}
                  </Badge>
                  {row.level === "warn" ? (
                    <Badge variant="outline" className="font-normal">
                      Aviso
                    </Badge>
                  ) : null}
                  {row.known ? <Badge className="font-normal">Conhecido</Badge> : null}
                </div>
                <p className="min-w-0 break-words text-sm">{row.message}</p>
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {row.count} vez{row.count > 1 ? "es" : ""}
                  </span>
                  <span>último <RelativeTime date={row.lastSeen} /></span>
                  {row.organizationId ? (
                    <Link href={`/spaces/${row.organizationId}?tab=saude`} className="break-words underline underline-offset-2">
                      {row.organizationName}
                    </Link>
                  ) : null}
                  {row.lastReference ? <span className="font-mono">{row.lastReference}</span> : null}
                </p>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={list.page} hasNext={list.hasNext} totalPages={info.totalPages} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
    </div>
  );
}

async function Jobs({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const last = await lastRunPerJob();
  const job = pickOption(params.job, last.map((item) => item.job));
  const status = pickOption(params.status, JOB_RUN_STATUSES);
  const period = pickOption(params.period, Object.keys(PERIODS) as Period[]);
  const list = await listJobRunsPage({ job, status, period, page });
  const runs = list.rows;
  const info = pageInfo(list.page, list.total);
  const hasFilters = Boolean(job || status || period);
  const clear = ["job", "status", "period"];
  return (
    <div className="space-y-4">
      {last.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma rotina rodou ainda.</p>
      ) : (
        <StatGrid className="mb-0">
          {last.map((job) => (
            <StatCard
              key={job.job}
              label={JOB_LABEL[job.job] ?? job.job}
              value={<span className="text-lg"><RelativeTime date={job.startedAt} /></span>}
              tone={job.status === "ok" ? "success" : "danger"}
              sub={job.failures ? `${job.failures} falha${job.failures > 1 ? "s" : ""}` : JOB_STATUS_LABEL[job.status] ?? job.status}
            />
          ))}
        </StatGrid>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UrlSelect param="job" ariaLabel="Rotina" allLabel="Todas as rotinas" options={last.map((item) => [item.job, JOB_LABEL[item.job] ?? item.job] as const)} className="sm:w-64" />
        <UrlSelect param="status" ariaLabel="Situação" allLabel="Todas as situações" options={JOB_RUN_STATUSES.map((value) => [value, JOB_STATUS_LABEL[value]] as const)} className="sm:w-52" />
        <UrlSelect
          param="period"
          ariaLabel="Período"
          allLabel="Todo o período"
          options={Object.entries(PERIODS).map(([value, label]) => [value, `Últimos ${label}`] as const)}
        />
        <UrlClearFilters params={clear} />
      </div>
      <div className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "execução", "execuções")}</p>
        <ListContainer
          emptyState={
            runs.length === 0 ? (
              <EmptyState icon={Activity} title={hasFilters ? "Nenhuma execução com esses filtros." : "Nenhuma execução registrada."} description={hasFilters ? "Tente outro período ou limpe os filtros." : undefined}>
                <UrlClearFilters params={clear} />
              </EmptyState>
            ) : undefined
          }
        >
          {runs.map((run) => (
            <ListRow key={run.id}>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="min-w-0 break-words text-sm font-medium">{JOB_LABEL[run.job] ?? run.job}</p>
                  {run.failures ? (
                    <Badge variant="destructive">
                      {run.failures} falha{run.failures > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                </div>
                <p className="min-w-0 break-words text-xs text-muted-foreground">
                  <RelativeTime date={run.startedAt} /> · {run.durationSeconds === null ? "Rodando" : `${run.durationSeconds} s`}
                  {run.organizations !== null ? ` · ${run.organizations} espaço${run.organizations === 1 ? "" : "s"}` : ""}
                </p>
                {run.errorReferences.length > 0 ? <p className={`${MONO} text-muted-foreground`}>{run.errorReferences.join(", ")}</p> : null}
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={list.page} hasNext={list.hasNext} totalPages={info.totalPages} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
    </div>
  );
}

async function Webhooks({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const stats = await webhookStats();
  const status = pickOption(params.status, Object.keys(WEBHOOK_STATUS_LABEL));
  const event = pickOption(params.event, stats.events);
  const period = pickOption(params.period, Object.keys(PERIODS) as Period[]);
  const q = normalizeSearch(params.q);
  const list = await listWebhooks({ status, event, period, q, page });
  const info = pageInfo(list.page, list.total);
  const hasFilters = Boolean(status || event || period || q);
  const clear = ["q", "status", "event", "period"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Últimas 24 h:</span>
        {stats.byStatus.length === 0 ? (
          <span>nenhum aviso</span>
        ) : (
          stats.byStatus.map((s) => (
            <Badge key={s.status} variant={s.status === "failed" ? "destructive" : "secondary"} className="font-normal">
              {WEBHOOK_STATUS_LABEL[s.status] ?? s.status}: {s.count}
            </Badge>
          ))
        )}
        <span>· Último aviso <RelativeTime date={stats.lastReceivedAt} empty="nunca" /></span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UrlSearch placeholder="Código do evento ou espaço" ariaLabel="Buscar avisos" />
        <UrlSelect param="status" ariaLabel="Situação" allLabel="Todas as situações" options={Object.entries(WEBHOOK_STATUS_LABEL)} className="sm:w-52" />
        <UrlSelect param="event" ariaLabel="Evento" allLabel="Todos os eventos" options={stats.events.map((e) => [e, e] as const)} className="sm:w-64" />
        <UrlSelect
          param="period"
          ariaLabel="Período"
          allLabel="Todo o período"
          options={Object.entries(PERIODS).map(([value, label]) => [value, `Últimos ${label}`] as const)}
        />
        <UrlClearFilters params={clear} />
      </div>
      <div className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "aviso", "avisos")}</p>
        <ListContainer
          emptyState={
            list.rows.length === 0 ? (
              <EmptyState icon={Bell} title={hasFilters ? "Nenhum aviso com esses filtros." : "Nenhum aviso do parceiro ainda."} description={hasFilters ? "Tente outro período ou limpe os filtros." : undefined}>
                <UrlClearFilters params={clear} />
              </EmptyState>
            ) : undefined
          }
        >
          {list.rows.map((row) => (
            <ListRow key={row.id}>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={MONO}>{row.event}</p>
                  <Badge variant={row.status === "failed" ? "destructive" : "secondary"} className="font-normal">
                    {WEBHOOK_STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                  {row.attempts > 1 ? <span className="text-xs text-muted-foreground">{row.attempts} tentativas</span> : null}
                </div>
                {row.outcome ?? row.errorReference ? <p className="min-w-0 break-words text-sm text-muted-foreground">{row.outcome ?? row.errorReference}</p> : null}
                <p className="min-w-0 break-words text-xs text-muted-foreground">
                  <RelativeTime date={row.receivedAt} />
                  {row.organizationId ? (
                    <>
                      {" · "}
                      <Link href={`/spaces/${row.organizationId}?tab=saude`} className="underline underline-offset-2">
                        {row.organizationName}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={list.page} hasNext={list.hasNext} totalPages={info.totalPages} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
    </div>
  );
}

async function Integrations() {
  const [gateway, stats] = await Promise.all([gatewayOverview(), webhookStats()]);
  const failed = stats.byStatus.find((s) => s.status === "failed")?.count ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas de recebimento dos espaços</CardTitle>
          <CardDescription>Situação das subcontas no parceiro de pagamentos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {gateway.map((g) => (
              <li key={g.status} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">{GATEWAY_LABEL[g.status] ?? g.status}</span>
                <span className="font-medium tabular-nums">{g.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avisos do parceiro</CardTitle>
          <CardDescription>Último aviso <RelativeTime date={stats.lastReceivedAt} empty="nunca" />.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            {failed > 0 ? (
              <span className="text-destructive">
                {failed} aviso{failed > 1 ? "s" : ""} com falha nas últimas 24 h.
              </span>
            ) : (
              <span className="text-success">Nenhuma falha nas últimas 24 h.</span>
            )}
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/health?tab=avisos&status=failed">Ver os avisos com falha</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
