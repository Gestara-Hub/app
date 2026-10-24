import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/shared/pager";
import { TabLinks } from "@/components/shared/tab-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { markKnownAction, unmarkKnownAction } from "./actions";

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
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Erros nas últimas 24 h</p>
          <p className="text-2xl font-semibold tabular-nums">{totals.today}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Espaços afetados</p>
          <p className="text-2xl font-semibold tabular-nums">{totals.spacesAffected}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Ainda não conhecidos</p>
          <p className="text-2xl font-semibold tabular-nums">{totals.unknown}</p>
        </Card>
      </div>

      <form action="/health" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="erros" />
        <Input name="q" defaultValue={q} placeholder="Código do erro, onde ou mensagem" aria-label="Buscar erros" className="w-72 text-base md:text-sm" />
        <select name="period" defaultValue={period} aria-label="Período" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          {Object.entries(PERIODS).map(([value, label]) => (
            <option key={value} value={value}>{`Últimos ${label}`}</option>
          ))}
        </select>
        <select name="source" defaultValue={params.source ?? ""} aria-label="Origem" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          <option value="">Todas as origens</option>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="level" defaultValue={params.level ?? ""} aria-label="Nível" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          <option value="">Erros e avisos</option>
          <option value="error">Só erros</option>
          <option value="warn">Só avisos</option>
        </select>
        <select name="known" defaultValue={params.known ?? ""} aria-label="Conhecidos" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          <option value="">Com os conhecidos</option>
          <option value="hide">Esconder os conhecidos</option>
        </select>
        <Button type="submit">Filtrar</Button>
      </form>

      {byCode ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Código {byCode.lastReference}</CardTitle>
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
            <p className="font-mono text-xs break-all">{byCode.event}</p>
            <p className="break-words">{byCode.message}</p>
            <p className="text-muted-foreground">
              {byCode.count} vez{byCode.count > 1 ? "es" : ""} · último {ago(byCode.lastSeen)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Onde</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Espaço</TableHead>
              <TableHead className="text-right">Vezes</TableHead>
              <TableHead>Último</TableHead>
              <TableHead>Código</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum erro com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              list.rows.map((row) => (
                <TableRow key={row.id} className={row.known ? "opacity-60" : undefined}>
                  <TableCell>
                    <p className="font-mono text-xs break-all">{row.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABEL[row.source] ?? row.source}
                      {row.level === "warn" ? " · aviso" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-80 break-words">{row.message}</TableCell>
                  <TableCell className="break-words">
                    {row.organizationId ? (
                      <Link href={`/spaces/${row.organizationId}?tab=saude`} className="hover:underline">
                        {row.organizationName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground" title={dateTime(row.lastSeen)}>
                    {ago(row.lastSeen)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.lastReference ?? "—"}</TableCell>
                  <TableCell>
                    <form action={row.known ? unmarkKnownAction : markKnownAction}>
                      <input type="hidden" name="fingerprint" value={row.fingerprint} />
                      <Button type="submit" variant="ghost" size="xs">
                        {row.known ? "Desmarcar conhecido" : "Marcar conhecido"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={page} hasNext={list.hasNext} href={(p) => `/health?${query({ page: p > 1 ? String(p) : undefined })}`} />
    </div>
  );
}

async function Jobs() {
  const [runs, last] = await Promise.all([listJobRuns(30), lastRunPerJob()]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {last.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma rotina rodou ainda.</p> : null}
        {last.map((job) => (
          <Card key={job.job} className="gap-1 p-4">
            <p className="text-xs text-muted-foreground">{JOB_LABEL[job.job] ?? job.job}</p>
            <p className="text-base font-semibold">{ago(job.startedAt)}</p>
            <Badge variant={job.status === "ok" ? "secondary" : "destructive"} className="w-fit font-normal">
              {job.failures ? `${job.failures} falha${job.failures > 1 ? "s" : ""}` : JOB_STATUS_LABEL[job.status] ?? job.status}
            </Badge>
          </Card>
        ))}
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rotina</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead className="text-right">Espaços</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Códigos de erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{JOB_LABEL[run.job] ?? run.job}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(run.startedAt)}</TableCell>
                <TableCell>{run.durationSeconds === null ? "Rodando" : `${run.durationSeconds} s`}</TableCell>
                <TableCell className="text-right tabular-nums">{run.organizations ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{run.failures ?? 0}</TableCell>
                <TableCell className="font-mono text-xs break-all">{run.errorReferences.join(", ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

async function Webhooks({ params, page, query }: { params: Record<string, string | undefined>; page: number; query: (o: Record<string, string | undefined>) => string }) {
  const [stats, list] = await Promise.all([webhookStats(), listWebhooks({ status: params.status || undefined, event: params.event || undefined, page })]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Últimas 24 h:</span>
        {stats.byStatus.length === 0 ? <span>nenhum aviso</span> : stats.byStatus.map((s) => <Badge key={s.status} variant="secondary" className="font-normal">{s.status}: {s.count}</Badge>)}
        <span>· Último aviso {ago(stats.lastReceivedAt)}</span>
      </div>
      <form action="/health" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="avisos" />
        <select name="status" defaultValue={params.status ?? ""} aria-label="Situação" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          <option value="">Todas as situações</option>
          {["received", "processed", "ignored", "failed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="event" defaultValue={params.event ?? ""} aria-label="Evento" className="h-9 rounded-md border bg-background px-2 text-base md:text-sm">
          <option value="">Todos os eventos</option>
          {stats.events.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <Button type="submit">Filtrar</Button>
      </form>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Espaço</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum aviso com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              list.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(row.receivedAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.event}</TableCell>
                  <TableCell>{row.organizationId ? <Link href={`/spaces/${row.organizationId}?tab=saude`} className="hover:underline">{row.organizationName}</Link> : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "failed" ? "destructive" : "secondary"} className="font-normal">{row.status}</Badge>
                    {row.attempts > 1 ? <span className="ml-1 text-xs text-muted-foreground">{row.attempts} tentativas</span> : null}
                  </TableCell>
                  <TableCell className="break-words text-muted-foreground">{row.outcome ?? row.errorReference ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
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
              <li key={g.status} className="flex items-center justify-between py-2">
                <span>{GATEWAY_LABEL[g.status] ?? g.status}</span>
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
              <span className="text-destructive">{failed} aviso{failed > 1 ? "s" : ""} com falha nas últimas 24 h.</span>
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
