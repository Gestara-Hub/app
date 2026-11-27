import "server-only";
import { sql } from "./db";
import { likePattern, normalizeSearch } from "../filter-input";
import { LIST_PAGE_SIZE } from "../pagination";
import { fetchPage } from "./page-fetch";
import type { BugStatus } from "../support-types";

/**
 * Saude do sistema para o painel (doc technical/26, fase 4): erros agrupados
 * (ja mascarados pelo app dos clientes), rotinas, avisos do parceiro de
 * pagamentos e o estado das integracoes. So leitura, mais "erro conhecido".
 */
export const HEALTH_PAGE_SIZE = LIST_PAGE_SIZE;

export const PERIODS = { "24h": "24 horas", "7d": "7 dias", "30d": "30 dias" } as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (value: unknown): value is Period => typeof value === "string" && value in PERIODS;
const PERIOD_HOURS: Record<Period, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

export interface ErrorRow {
  id: string;
  fingerprint: string;
  source: string;
  level: string;
  event: string;
  message: string;
  stack: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  lastReference: string | null;
  organizationId: string | null;
  organizationName: string | null;
  known: boolean;
}

type DbError = {
  id: string; fingerprint: string; source: string; level: string; event: string; message: string; stack: string | null; count: number;
  first_seen: Date; last_seen: Date; last_reference: string | null; organization_id: string | null; organization_name: string | null; known: boolean;
};

const toError = (r: DbError): ErrorRow => ({
  id: r.id, fingerprint: r.fingerprint, source: r.source, level: r.level, event: r.event, message: r.message, stack: r.stack, count: r.count,
  firstSeen: r.first_seen, lastSeen: r.last_seen, lastReference: r.last_reference, organizationId: r.organization_id,
  organizationName: r.organization_name, known: r.known,
});

export async function listErrors(input: {
  period: Period;
  source?: string;
  level?: string;
  organizationId?: string;
  q?: string;
  hideKnown?: boolean;
  page: number;
}): Promise<{ rows: ErrorRow[]; hasNext: boolean; total: number; page: number }> {
  const search = normalizeSearch(input.q);
  const q = likePattern(search);
  const reference = search.toUpperCase() || null;
  const result = await fetchPage(input.page, (page) =>
    sql()<(DbError & { total: number })[]>`
      select e.id, e.fingerprint, e.source, e.level, e.event, e.message, e.stack, e.count, e.first_seen, e.last_seen, e.last_reference,
             e.organization_id, o.name as organization_name, (k.fingerprint is not null) as known, (count(*) over ())::int as total
        from public.error_logs e
        left join public.organizations o on o.id = e.organization_id
        left join platform.known_errors k on k.fingerprint = e.fingerprint
       where e.last_seen >= now() - make_interval(hours => ${PERIOD_HOURS[input.period]})
         and (${input.source ?? null}::text is null or e.source = ${input.source ?? null})
         and (${input.level ?? null}::text is null or e.level = ${input.level ?? null})
         and (${input.organizationId ?? null}::text is null or e.organization_id = ${input.organizationId ?? null})
         and (${input.hideKnown ?? false} = false or k.fingerprint is null)
         and (${q}::text is null or e.last_reference = ${reference} or exists (select 1 from public.error_occurrences oc where oc.error_id = e.id and oc.reference = ${reference}) or e.event ilike ${q} or e.message ilike ${q} or o.name ilike ${q})
       order by e.last_seen desc, e.id
       limit ${HEALTH_PAGE_SIZE} offset ${(page - 1) * HEALTH_PAGE_SIZE}`,
  );
  return { rows: result.rows.map(toError), hasNext: result.page * HEALTH_PAGE_SIZE < result.total, total: result.total, page: result.page };
}

/** O codigo que o cliente viu ("K7Q2M9XD") leva direto a linha e ao espaco, mesmo que o erro tenha se repetido depois. */
export async function findErrorByReference(code: string): Promise<ErrorRow | null> {
  const [row] = await sql()<DbError[]>`
    select e.id, e.fingerprint, e.source, e.level, e.event, e.message, e.stack, e.count, e.first_seen, e.last_seen, e.last_reference,
           e.organization_id, o.name as organization_name, (k.fingerprint is not null) as known
      from public.error_logs e
      left join public.organizations o on o.id = e.organization_id
      left join platform.known_errors k on k.fingerprint = e.fingerprint
     where e.last_reference = ${code.trim().toUpperCase()}
        or exists (select 1 from public.error_occurrences oc where oc.error_id = e.id and oc.reference = ${code.trim().toUpperCase()})
     order by e.last_seen desc limit 1`;
  return row ? toError(row) : null;
}

export interface ErrorDetail extends ErrorRow {
  /** Contexto da última ocorrência (método, rota, tela), já mascarado pelo app dos clientes. */
  context: Record<string, unknown>;
  /** Conversas de suporte abertas com o código deste erro. */
  threads: { id: string; number: number; subject: string; status: string; bugStatus: BugStatus | null }[];
  /** As ocorrências mais recentes (até 20), da mais nova para a mais antiga. */
  occurrences: ErrorOccurrence[];
}

export interface ErrorOccurrence {
  reference: string | null;
  /** Quem estava no sistema (id interno do usuário); vazio se o erro foi antes do login ou numa rotina. */
  userId: string | null;
  /** Conversa de suporte aberta com o código desta ocorrência. */
  thread: { id: string; number: number } | null;
  occurredAt: Date;
  message: string;
  /** Tela, perfil, plano, versão e tempo da hora (já mascarado pelo app dos clientes). */
  context: Record<string, unknown>;
}

/** Um erro com tudo o que o registro guarda (pilha, contexto) e as conversas ligadas ao código. */
export async function getErrorDetail(id: string): Promise<ErrorDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql()<(DbError & { context: Record<string, unknown> })[]>`
    select e.id, e.fingerprint, e.source, e.level, e.event, e.message, e.stack, e.count, e.first_seen, e.last_seen, e.last_reference,
           e.organization_id, o.name as organization_name, (k.fingerprint is not null) as known, e.context
      from public.error_logs e
      left join public.organizations o on o.id = e.organization_id
      left join platform.known_errors k on k.fingerprint = e.fingerprint
     where e.id = ${id}`;
  if (!row) return null;
  const occurrences = await sql()<
    { reference: string | null; user_id: string | null; occurred_at: Date; message: string; context: Record<string, unknown>; thread_id: string | null; thread_number: number | null }[]
  >`
    select oc.reference, oc.user_id, oc.occurred_at, oc.message, oc.context, t.id as thread_id, t.number as thread_number
      from public.error_occurrences oc
      left join lateral (
        select id, number from platform.support_threads where error_reference = oc.reference order by created_at limit 1
      ) t on true
     where oc.error_id = ${id} order by oc.occurred_at desc, oc.id desc limit 20`;
  // Conversas abertas com o código de qualquer uma das ocorrências (não só a última).
  const codes = [...new Set([row.last_reference, ...occurrences.map((o) => o.reference)].filter((c): c is string => Boolean(c)))];
  const threads = codes.length
    ? await sql()<{ id: string; number: number; subject: string; status: string; kind: string; bug_status: BugStatus | null }[]>`
        select id, number, subject, status, kind, bug_status from platform.support_threads where error_reference in ${sql()(codes)} order by created_at desc limit 10`
    : [];
  return {
    ...toError(row),
    context: row.context ?? {},
    threads: threads.map((t) => ({ id: t.id, number: t.number, subject: t.subject, status: t.status, bugStatus: t.kind === "bug" ? (t.bug_status ?? "new") : null })),
    occurrences: occurrences.map((o) => ({
      reference: o.reference,
      userId: o.user_id,
      thread: o.thread_id && o.thread_number !== null ? { id: o.thread_id, number: o.thread_number } : null,
      occurredAt: o.occurred_at,
      message: o.message,
      context: o.context ?? {},
    })),
  };
}

/** Uma ocorrência com o erro a que pertence e o espaço (a visão "o que aconteceu com esta pessoa"). */
export interface OccurrenceHit {
  errorId: string;
  event: string;
  source: string;
  level: string;
  reference: string | null;
  userId: string | null;
  occurredAt: Date;
  message: string;
  context: Record<string, unknown>;
  organizationId: string | null;
  organizationName: string | null;
}

type DbHit = {
  error_id: string; event: string; source: string; level: string; reference: string | null; user_id: string | null; occurred_at: Date;
  message: string; context: Record<string, unknown>; organization_id: string | null; organization_name: string | null;
};

const toHit = (r: DbHit): OccurrenceHit => ({
  errorId: r.error_id, event: r.event, source: r.source, level: r.level, reference: r.reference, userId: r.user_id, occurredAt: r.occurred_at,
  message: r.message, context: r.context ?? {}, organizationId: r.organization_id, organizationName: r.organization_name,
});

/** A ocorrência exata que tem este código (o que a pessoa viu na tela), com a tela, o perfil e a versão da hora. */
export async function getOccurrenceByReference(code: string): Promise<OccurrenceHit | null> {
  const [row] = await sql()<DbHit[]>`
    select oc.error_id, e.event, e.source, e.level, oc.reference, oc.user_id, oc.occurred_at, oc.message, oc.context,
           e.organization_id, o.name as organization_name
      from public.error_occurrences oc
      join public.error_logs e on e.id = oc.error_id
      left join public.organizations o on o.id = e.organization_id
     where oc.reference = ${code.trim().toUpperCase()}`;
  return row ? toHit(row) : null;
}

/** Ocorrências de uma pessoa, da mais nova para a mais antiga: numa janela em volta de um instante ou nos últimos dias. */
export async function listUserOccurrences(input: { userId: string; around?: Date; windowMinutes?: number; days?: number; limit?: number }): Promise<OccurrenceHit[]> {
  const window = input.windowMinutes ?? 30;
  const rows = await sql()<DbHit[]>`
    select oc.error_id, e.event, e.source, e.level, oc.reference, oc.user_id, oc.occurred_at, oc.message, oc.context,
           e.organization_id, o.name as organization_name
      from public.error_occurrences oc
      join public.error_logs e on e.id = oc.error_id
      left join public.organizations o on o.id = e.organization_id
     where oc.user_id = ${input.userId}
       and (${input.around ?? null}::timestamptz is null
            or oc.occurred_at between ${input.around ?? null}::timestamptz - make_interval(mins => ${window})
                                  and ${input.around ?? null}::timestamptz + make_interval(mins => ${window}))
       and (${input.around ? null : (input.days ?? 30)}::int is null or oc.occurred_at > now() - make_interval(days => ${input.around ? 0 : (input.days ?? 30)}))
     order by oc.occurred_at desc, oc.id desc
     limit ${input.limit ?? 50}`;
  return rows.map(toHit);
}

export async function errorTotals(): Promise<{ today: number; spacesAffected: number; unknown: number }> {
  const [row] = await sql()<{ today: number; spaces: number; unknown: number }[]>`
    select count(*)::int as today,
           count(distinct e.organization_id)::int as spaces,
           count(*) filter (where k.fingerprint is null)::int as unknown
      from public.error_logs e left join platform.known_errors k on k.fingerprint = e.fingerprint
     where e.last_seen >= now() - interval '24 hours'`;
  return { today: row.today, spacesAffected: row.spaces, unknown: row.unknown };
}

export async function markKnown(input: { fingerprint: string; adminId: string; adminName: string; note?: string }): Promise<void> {
  await sql()`insert into platform.known_errors (fingerprint, admin_id, admin_name, note) values (${input.fingerprint}, ${input.adminId}, ${input.adminName}, ${input.note ?? null})
              on conflict (fingerprint) do nothing`;
}

export async function unmarkKnown(fingerprint: string): Promise<void> {
  await sql()`delete from platform.known_errors where fingerprint = ${fingerprint}`;
}

export interface JobRunRow {
  id: string;
  job: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  organizations: number | null;
  failures: number | null;
  durationSeconds: number | null;
  errorReferences: string[];
}

type DbJobRun = { id: string; job: string; started_at: Date; finished_at: Date | null; status: string; organizations: number | null; failures: number | null; error_references: string[] | null };

const toJobRun = (r: DbJobRun): JobRunRow => ({
  id: r.id,
  job: r.job,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.status,
  organizations: r.organizations,
  failures: r.failures,
  durationSeconds: r.finished_at ? Math.max(0, Math.round((r.finished_at.getTime() - r.started_at.getTime()) / 1000)) : null,
  errorReferences: r.error_references ?? [],
});

export async function listJobRuns(limit = 30): Promise<JobRunRow[]> {
  const rows = await sql()<DbJobRun[]>`select id, job, started_at, finished_at, status, organizations, failures, error_references from public.job_runs order by started_at desc limit ${limit}`;
  return rows.map(toJobRun);
}

export const JOB_RUN_STATUSES = ["ok", "partial", "failed", "running"] as const;

/** Execuções das rotinas com filtro por rotina, situação e período, paginadas com o total. */
export async function listJobRunsPage(input: { job?: string; status?: string; period?: Period; page: number }): Promise<{ rows: JobRunRow[]; total: number; page: number; hasNext: boolean }> {
  const hours = input.period ? PERIOD_HOURS[input.period] : null;
  const result = await fetchPage(input.page, (page) =>
    sql()<(DbJobRun & { total: number })[]>`
      select id, job, started_at, finished_at, status, organizations, failures, error_references, (count(*) over ())::int as total
        from public.job_runs
       where (${input.job ?? null}::text is null or job = ${input.job ?? null})
         and (${input.status ?? null}::text is null or status = ${input.status ?? null})
         and (${hours}::int is null or started_at >= now() - make_interval(hours => ${hours}::int))
       order by started_at desc, id
       limit ${HEALTH_PAGE_SIZE} offset ${(page - 1) * HEALTH_PAGE_SIZE}`,
  );
  return { rows: result.rows.map(toJobRun), total: result.total, page: result.page, hasNext: result.page * HEALTH_PAGE_SIZE < result.total };
}

/** Ultima execucao de cada rotina (para o aviso "a rotina nao rodou hoje"). */
export async function lastRunPerJob(): Promise<{ job: string; startedAt: Date; status: string; failures: number | null }[]> {
  const rows = await sql()<{ job: string; started_at: Date; status: string; failures: number | null }[]>`
    select distinct on (job) job, started_at, status, failures from public.job_runs order by job, started_at desc`;
  return rows.map((r) => ({ job: r.job, startedAt: r.started_at, status: r.status, failures: r.failures }));
}

export interface WebhookRow {
  id: string;
  provider: string;
  event: string;
  status: string;
  outcome: string | null;
  attempts: number;
  organizationId: string | null;
  organizationName: string | null;
  receivedAt: Date;
  errorReference: string | null;
}

export async function listWebhooks(input: { status?: string; event?: string; organizationId?: string; q?: string; period?: Period; page: number }): Promise<{ rows: WebhookRow[]; hasNext: boolean; total: number; page: number }> {
  const q = likePattern(normalizeSearch(input.q));
  const hours = input.period ? PERIOD_HOURS[input.period] : null;
  const result = await fetchPage(input.page, (page) =>
    sql()<
      { id: string; provider: string; event: string; status: string; outcome: string | null; attempts: number; organization_id: string | null; organization_name: string | null; received_at: Date; error_reference: string | null; total: number }[]
    >`
      select w.id, w.provider, w.event, w.status, w.outcome, w.attempts, w.organization_id, o.name as organization_name, w.received_at, w.error_reference,
             (count(*) over ())::int as total
        from public.webhook_events w left join public.organizations o on o.id = w.organization_id
       where (${input.status ?? null}::text is null or w.status = ${input.status ?? null})
         and (${input.event ?? null}::text is null or w.event = ${input.event ?? null})
         and (${input.organizationId ?? null}::text is null or w.organization_id = ${input.organizationId ?? null})
         and (${hours}::int is null or w.received_at >= now() - make_interval(hours => ${hours}::int))
         and (${q}::text is null or w.event ilike ${q} or w.event_id ilike ${q} or o.name ilike ${q})
       order by w.received_at desc, w.id
       limit ${HEALTH_PAGE_SIZE} offset ${(page - 1) * HEALTH_PAGE_SIZE}`,
  );
  return {
    rows: result.rows.map((r) => ({
      id: r.id, provider: r.provider, event: r.event, status: r.status, outcome: r.outcome, attempts: r.attempts, organizationId: r.organization_id,
      organizationName: r.organization_name, receivedAt: r.received_at, errorReference: r.error_reference,
    })),
    hasNext: result.page * HEALTH_PAGE_SIZE < result.total,
    total: result.total,
    page: result.page,
  };
}

export async function webhookStats(): Promise<{ byStatus: { status: string; count: number }[]; events: string[]; lastReceivedAt: Date | null }> {
  const byStatus = await sql()<{ status: string; count: number }[]>`
    select status, count(*)::int as count from public.webhook_events where received_at >= now() - interval '24 hours' group by status order by status`;
  const events = await sql()<{ event: string }[]>`select distinct event from public.webhook_events order by event limit 50`;
  const [last] = await sql()<{ at: Date | null }[]>`select max(received_at) as at from public.webhook_events`;
  return { byStatus, events: events.map((e) => e.event), lastReceivedAt: last?.at ?? null };
}

export async function gatewayOverview(): Promise<{ status: string; count: number }[]> {
  return sql()<{ status: string; count: number }[]>`
    select coalesce(gateway_status, 'not_configured') as status, count(*)::int as count from public.organizations group by 1 order by 2 desc`;
}

/**
 * Espacos com a chave de API da subconta invalida (expirou, desligada, apagada
 * ou recusada; 27/11/2026). O "Cobrar online" deles esta travado ate a troca.
 */
export interface ApiKeyIssue {
  organizationId: string;
  organizationName: string;
  reason: string | null;
  updatedAt: Date | null;
}

export async function apiKeyIssues(): Promise<ApiKeyIssue[]> {
  const rows = await sql()<{ id: string; name: string; reason: string | null; updated_at: string | null }[]>`
    select id, name,
           settings #>> '{onlinePayments,apiKeyStatus,reason}' as reason,
           settings #>> '{onlinePayments,apiKeyStatus,updatedAt}' as updated_at
      from public.organizations
     where settings #>> '{onlinePayments,apiKeyStatus,state}' = 'invalid'
     order by name`;
  return rows.map((r) => ({
    organizationId: r.id,
    organizationName: r.name,
    reason: r.reason,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }));
}
