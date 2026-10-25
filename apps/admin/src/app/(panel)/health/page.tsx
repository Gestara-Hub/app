import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { TabLinks } from "@/components/shared/tab-links";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ago, dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/server/context";
import {
  PERIODS,
  errorTotals,
  findErrorByReference,
  gatewayOverview,
  isPeriod,
  lastRunPerJob,
  listErrors,
  listJobRuns,
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
const MONO = "break-all font-mono text-xs";

export default async function HealthPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("health:view");
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? (params.tab as string) : "erros";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
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
      {tab === "rotinas" ? <Jobs /> : null}
      {tab === "avisos" ? <Webhooks params={params} page={page} query={query} /> : null}
      {tab === "integracoes" ? <Integrations /> : null}
    </>
  );
}

async function Errors({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const period: Period = isPeriod(params.period) ? params.period : "24h";
  const q = params.q?.trim() ?? "";
  const [totals, list, byCode] = await Promise.all([
    errorTotals(),
    listErrors({ period, source: params.source || undefined, level: params.level || undefined, q, hideKnown: params.known === "hide", page }),
    q && /^[A-Za-z0-9]{6,10}$/.test(q) ? findErrorByReference(q) : Promise.resolve(null),
  ]);
  const hasFilters = Boolean(q || params.period || params.source || params.level || params.known);
  return (
    <div className="space-y-4">
      <StatGrid className="mb-0">
        <StatCard label="Erros nas últimas 24 h" value={totals.today} tone={totals.today > 0 ? "warning" : "default"} />
        <StatCard label="Espaços afetados" value={totals.spacesAffected} />
        <StatCard label="Ainda não conhecidos" value={totals.unknown} tone={totals.unknown > 0 ? "danger" : "default"} />
      </StatGrid>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UrlSearch placeholder="Código, local ou mensagem" ariaLabel="Buscar erros" />
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
        <UrlClearFilters params={["q", "period", "source", "level", "known"]} />
      </div>

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
              {byCode.count} vez{byCode.count > 1 ? "es" : ""} · último {ago(byCode.lastSeen)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <ListSummaryBar count={list.rows.length} singularLabel="erro nesta página" pluralLabel="erros nesta página" />
        <ListContainer
          emptyState={list.rows.length === 0 ? <EmptyState icon={AlertTriangle} title="Nenhum erro com esses filtros." description={hasFilters ? "Tente outro período ou limpe os filtros." : undefined} /> : undefined}
        >
          {list.rows.map((row) => (
            <ListRow key={row.id} className={row.known ? "opacity-60" : undefined} actions={<ErrorRowMenu id={row.id} fingerprint={row.fingerprint} known={row.known} event={row.event} />}>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/health/errors/${row.id}`} className={`${MONO} hover:underline`}>
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
                  <span title={dateTime(row.lastSeen)}>último {ago(row.lastSeen)}</span>
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
      <Pager page={page} hasNext={list.hasNext} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
    </div>
  );
}

async function Jobs() {
  const [runs, last] = await Promise.all([listJobRuns(30), lastRunPerJob()]);
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
              value={<span className="text-lg">{ago(job.startedAt)}</span>}
              tone={job.status === "ok" ? "success" : "danger"}
              sub={job.failures ? `${job.failures} falha${job.failures > 1 ? "s" : ""}` : JOB_STATUS_LABEL[job.status] ?? job.status}
            />
          ))}
        </StatGrid>
      )}
      <div className="space-y-2">
        <ListSummaryBar count={runs.length} singularLabel="execução" pluralLabel="execuções" />
        <ListContainer emptyState={runs.length === 0 ? <EmptyState icon={Activity} title="Nenhuma execução registrada." /> : undefined}>
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
                  {dateTime(run.startedAt)} · {run.durationSeconds === null ? "Rodando" : `${run.durationSeconds} s`}
                  {run.organizations !== null ? ` · ${run.organizations} espaço${run.organizations === 1 ? "" : "s"}` : ""}
                </p>
                {run.errorReferences.length > 0 ? <p className={`${MONO} text-muted-foreground`}>{run.errorReferences.join(", ")}</p> : null}
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
    </div>
  );
}

async function Webhooks({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const [stats, list] = await Promise.all([webhookStats(), listWebhooks({ status: params.status || undefined, event: params.event || undefined, page })]);
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
        <span>· Último aviso {ago(stats.lastReceivedAt)}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UrlSelect param="status" ariaLabel="Situação" allLabel="Todas as situações" options={Object.entries(WEBHOOK_STATUS_LABEL)} className="sm:w-52" />
        <UrlSelect param="event" ariaLabel="Evento" allLabel="Todos os eventos" options={stats.events.map((e) => [e, e] as const)} className="sm:w-64" />
        <UrlClearFilters params={["status", "event"]} />
      </div>
      <div className="space-y-2">
        <ListSummaryBar count={list.rows.length} singularLabel="aviso nesta página" pluralLabel="avisos nesta página" />
        <ListContainer emptyState={list.rows.length === 0 ? <EmptyState icon={Bell} title="Nenhum aviso com esses filtros." /> : undefined}>
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
                  {dateTime(row.receivedAt)}
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
      <Pager page={page} hasNext={list.hasNext} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
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
          <CardDescription>Último aviso {ago(stats.lastReceivedAt)}.</CardDescription>
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
