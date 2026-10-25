import "server-only";
import { sql } from "./db";

/**
 * Saude do sistema para o painel (doc technical/26, fase 4): erros agrupados
 * (ja mascarados pelo app dos clientes), rotinas, avisos do parceiro de
 * pagamentos e o estado das integracoes. So leitura, mais "erro conhecido".
 */
export const HEALTH_PAGE_SIZE = 25;

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

const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

export async function listErrors(input: {
  period: Period;
  source?: string;
  level?: string;
  organizationId?: string;
  q?: string;
  hideKnown?: boolean;
  page: number;
}): Promise<{ rows: ErrorRow[]; hasNext: boolean }> {
  const q = input.q?.trim() ? `%${escapeLike(input.q.trim())}%` : null;
  const reference = input.q?.trim().toUpperCase() ?? null;
  const rows = await sql()<DbError[]>`
    select e.id, e.fingerprint, e.source, e.level, e.event, e.message, e.stack, e.count, e.first_seen, e.last_seen, e.last_reference,
           e.organization_id, o.name as organization_name, (k.fingerprint is not null) as known
      from public.error_logs e
      left join public.organizations o on o.id = e.organization_id
      left join platform.known_errors k on k.fingerprint = e.fingerprint
     where e.last_seen >= now() - make_interval(hours => ${PERIOD_HOURS[input.period]})
       and (${input.source ?? null}::text is null or e.source = ${input.source ?? null})
       and (${input.level ?? null}::text is null or e.level = ${input.level ?? null})
       and (${input.organizationId ?? null}::text is null or e.organization_id = ${input.organizationId ?? null})
       and (${input.hideKnown ?? false} = false or k.fingerprint is null)
       and (${q}::text is null or e.last_reference = ${reference} or e.event ilike ${q} or e.message ilike ${q})
     order by e.last_seen desc
     limit ${HEALTH_PAGE_SIZE + 1} offset ${(input.page - 1) * HEALTH_PAGE_SIZE}`;
  return { rows: rows.slice(0, HEALTH_PAGE_SIZE).map(toError), hasNext: rows.length > HEALTH_PAGE_SIZE };
}

/** O codigo que o cliente viu ("K7Q2M9XD") leva direto a linha e ao espaco. */
export async function findErrorByReference(code: string): Promise<ErrorRow | null> {
  const [row] = await sql()<DbError[]>`
    select e.id, e.fingerprint, e.source, e.level, e.event, e.message, e.stack, e.count, e.first_seen, e.last_seen, e.last_reference,
           e.organization_id, o.name as organization_name, (k.fingerprint is not null) as known
      from public.error_logs e
      left join public.organizations o on o.id = e.organization_id
      left join platform.known_errors k on k.fingerprint = e.fingerprint
     where e.last_reference = ${code.trim().toUpperCase()}
     order by e.last_seen desc limit 1`;
  return row ? toError(row) : null;
}

export interface ErrorDetail extends ErrorRow {
  /** Contexto da última ocorrência (método, rota, tela), já mascarado pelo app dos clientes. */
  context: Record<string, unknown>;
  /** Conversas de suporte abertas com o código deste erro. */
  threads: { id: string; subject: string; status: string }[];
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
  const threads = row.last_reference
    ? await sql()<{ id: string; subject: string; status: string }[]>`
        select id, subject, status from platform.support_threads where error_reference = ${row.last_reference} order by created_at desc limit 10`
    : [];
  return { ...toError(row), context: row.context ?? {}, threads };
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

export async function listJobRuns(limit = 30): Promise<JobRunRow[]> {
  const rows = await sql()<
    { id: string; job: string; started_at: Date; finished_at: Date | null; status: string; organizations: number | null; failures: number | null; error_references: string[] | null }[]
  >`select id, job, started_at, finished_at, status, organizations, failures, error_references from public.job_runs order by started_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    job: r.job,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    organizations: r.organizations,
    failures: r.failures,
    durationSeconds: r.finished_at ? Math.max(0, Math.round((r.finished_at.getTime() - r.started_at.getTime()) / 1000)) : null,
    errorReferences: r.error_references ?? [],
  }));
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

export async function listWebhooks(input: { status?: string; event?: string; organizationId?: string; page: number }): Promise<{ rows: WebhookRow[]; hasNext: boolean }> {
  const rows = await sql()<
    { id: string; provider: string; event: string; status: string; outcome: string | null; attempts: number; organization_id: string | null; organization_name: string | null; received_at: Date; error_reference: string | null }[]
  >`
    select w.id, w.provider, w.event, w.status, w.outcome, w.attempts, w.organization_id, o.name as organization_name, w.received_at, w.error_reference
      from public.webhook_events w left join public.organizations o on o.id = w.organization_id
     where (${input.status ?? null}::text is null or w.status = ${input.status ?? null})
       and (${input.event ?? null}::text is null or w.event = ${input.event ?? null})
       and (${input.organizationId ?? null}::text is null or w.organization_id = ${input.organizationId ?? null})
     order by w.received_at desc
     limit ${HEALTH_PAGE_SIZE + 1} offset ${(input.page - 1) * HEALTH_PAGE_SIZE}`;
  return {
    rows: rows.slice(0, HEALTH_PAGE_SIZE).map((r) => ({
      id: r.id, provider: r.provider, event: r.event, status: r.status, outcome: r.outcome, attempts: r.attempts, organizationId: r.organization_id,
      organizationName: r.organization_name, receivedAt: r.received_at, errorReference: r.error_reference,
    })),
    hasNext: rows.length > HEALTH_PAGE_SIZE,
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
