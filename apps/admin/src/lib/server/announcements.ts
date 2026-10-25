import "server-only";
import { clampPage, likePattern, normalizeSearch } from "../filter-input";
import { LIST_PAGE_SIZE } from "../pagination";
import { sql } from "./db";

/**
 * Comunicados aos espacos (doc technical/26, fase 5). O painel cria, edita e
 * arquiva; o app dos clientes le pela funcao `public.announcements_for`.
 */
export type Severity = "info" | "warning" | "urgent";
export type Audience = "all" | "tier" | "area" | "spaces";
export type AnnouncementState = "active" | "scheduled" | "ended" | "archived";

export interface AnnouncementInput {
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  filter: { tiers?: string[]; areas?: string[]; spaces?: string[] };
  /** Vazio: comeca agora (hora do banco, sem depender do relogio do app). */
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  filter: AnnouncementInput["filter"];
  startsAt: Date;
  endsAt: Date | null;
  createdByName: string | null;
  archivedAt: Date | null;
  dismissed: number;
  state: AnnouncementState;
}

export function stateOf(row: { startsAt: Date; endsAt: Date | null; archivedAt: Date | null }, now = new Date()): AnnouncementState {
  if (row.archivedAt) return "archived";
  if (row.startsAt > now) return "scheduled";
  if (row.endsAt && row.endsAt <= now) return "ended";
  return "active";
}

interface Raw {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  audience_filter: AnnouncementInput["filter"];
  starts_at: Date;
  ends_at: Date | null;
  created_by_name: string | null;
  archived_at: Date | null;
  dismissed: number;
}

function map(r: Raw): AnnouncementRow {
  const base = { startsAt: r.starts_at, endsAt: r.ends_at, archivedAt: r.archived_at };
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    severity: r.severity,
    audience: r.audience,
    filter: r.audience_filter,
    createdByName: r.created_by_name,
    dismissed: r.dismissed,
    ...base,
    state: stateOf(base),
  };
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const rows = await sql()<Raw[]>`
    select a.id, a.title, a.body, a.severity, a.audience, a.audience_filter, a.starts_at, a.ends_at,
           a.created_by_name, a.archived_at,
           (select count(*)::int from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
      from platform.announcements a
     order by a.created_at desc
     limit 200`;
  return rows.map(map);
}

export const SEVERITIES: readonly Severity[] = ["info", "warning", "urgent"];
export const AUDIENCES: readonly Audience[] = ["all", "tier", "area", "spaces"];
export const STATES: readonly AnnouncementState[] = ["active", "scheduled", "ended", "archived"];

export interface AnnouncementQuery {
  /** Situação (ausente = todas). */
  state?: AnnouncementState;
  /** Busca pelo título (já normalizada, até 100 caracteres). */
  q?: string;
  severity?: Severity;
  audience?: Audience;
  page?: number;
}

/** Mesma regra de `stateOf`, em SQL, para filtrar e contar no banco. */
const STATE_SQL = `case when a.archived_at is not null then 'archived'
                        when a.starts_at > now() then 'scheduled'
                        when a.ends_at is not null and a.ends_at <= now() then 'ended'
                        else 'active' end`;

/**
 * Comunicados paginados (25 por página), do mais recente ao mais antigo, com o total do filtro.
 * `counts` são as contagens por situação sobre o conjunto filtrado por busca, importância e público
 * (sem a situação): assim cada aba do SegmentedLinks mostra quantos resultados terá ao clicar.
 */
export async function listAnnouncementsPage(query: AnnouncementQuery): Promise<{ rows: AnnouncementRow[]; total: number; page: number; counts: Record<AnnouncementState | "all", number> }> {
  const pattern = likePattern(normalizeSearch(query.q));
  const severity = query.severity ?? null;
  const audience = query.audience ?? null;
  const state = query.state ?? null;
  const base = sql()`
    (${pattern}::text is null or a.title ilike ${pattern}::text escape '\\')
    and (${severity}::text is null or a.severity::text = ${severity}::text)
    and (${audience}::text is null or a.audience::text = ${audience}::text)`;
  const stateWhere = sql()`(${state}::text is null or ${sql().unsafe(STATE_SQL)} = ${state}::text)`;
  const grouped = await sql()<{ state: AnnouncementState; n: number }[]>`
    select ${sql().unsafe(STATE_SQL)} as state, count(*)::int as n from platform.announcements a where ${base} group by 1`;
  const counts = { all: 0, active: 0, scheduled: 0, ended: 0, archived: 0 };
  for (const row of grouped) {
    counts[row.state] = row.n;
    counts.all += row.n;
  }
  const total = state ? counts[state] : counts.all;
  const page = clampPage(query.page ?? 1, total, LIST_PAGE_SIZE);
  const rows = await sql()<Raw[]>`
    select a.id, a.title, a.body, a.severity, a.audience, a.audience_filter, a.starts_at, a.ends_at,
           a.created_by_name, a.archived_at,
           (select count(*)::int from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
      from platform.announcements a
     where ${base} and ${stateWhere}
     order by a.created_at desc, a.id
     limit ${LIST_PAGE_SIZE} offset ${(page - 1) * LIST_PAGE_SIZE}`;
  return { rows: rows.map(map), total, page, counts };
}

/** Totais gerais dos cartões do topo (sem filtro): por situação e dispensas. */
export async function announcementTotals(): Promise<{ active: number; scheduled: number; ended: number; archived: number; dismissed: number }> {
  const [row] = await sql()<{ active: number; scheduled: number; ended: number; archived: number; dismissed: number }[]>`
    select count(*) filter (where s.state = 'active')::int as active,
           count(*) filter (where s.state = 'scheduled')::int as scheduled,
           count(*) filter (where s.state = 'ended')::int as ended,
           count(*) filter (where s.state = 'archived')::int as archived,
           coalesce(sum(s.dismissed), 0)::int as dismissed
      from (select ${sql().unsafe(STATE_SQL)} as state,
                   (select count(*) from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
              from platform.announcements a) s`;
  return row;
}

export async function getAnnouncement(id: string): Promise<AnnouncementRow | null> {
  const [row] = await sql()<Raw[]>`
    select a.id, a.title, a.body, a.severity, a.audience, a.audience_filter, a.starts_at, a.ends_at,
           a.created_by_name, a.archived_at,
           (select count(*)::int from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
      from platform.announcements a where a.id = ${id}`;
  return row ? map(row) : null;
}

export async function audienceCount(audience: Audience, filter: AnnouncementInput["filter"]): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`select platform.audience_count(${audience}, ${sql().json(filter as never)}) as n`;
  return row.n;
}

export async function createAnnouncement(input: AnnouncementInput, admin: { id: string; name: string }): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    insert into platform.announcements (title, body, severity, audience, audience_filter, starts_at, ends_at, created_by, created_by_name)
    values (${input.title}, ${input.body}, ${input.severity}, ${input.audience}, ${sql().json(input.filter as never)},
            coalesce(${input.startsAt}::timestamptz, now()), ${input.endsAt}, ${admin.id}, ${admin.name})
    returning id`;
  return row.id;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  await sql()`
    update platform.announcements
       set title = ${input.title}, body = ${input.body}, severity = ${input.severity}, audience = ${input.audience},
           audience_filter = ${sql().json(input.filter as never)}, starts_at = coalesce(${input.startsAt}::timestamptz, starts_at), ends_at = ${input.endsAt},
           updated_at = now()
     where id = ${id}`;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await sql()`update platform.announcements set archived_at = ${archived ? new Date() : null}, updated_at = now() where id = ${id}`;
}
